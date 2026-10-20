//

import { type Config } from "#src/config";
import { log } from "#src/log";
import amqp, {
  type AmqpConnectionManager,
  type Channel,
} from "amqp-connection-manager";

export async function checkIdpStatus(
  idpName: string,
  config: {
    MAP_FI_NAMES_TO_URL: Record<string, string>;
    HTTP_TIMEOUT: number;
    HTTP_ACCEPT: string;
    HTTP_USER_AGENT: string;
  },
): Promise<number> {
  if (!Object.hasOwn(config.MAP_FI_NAMES_TO_URL, idpName)) {
    return 404;
  }

  const url = config.MAP_FI_NAMES_TO_URL[idpName]!;
  const headers = new Headers({
    Accept: config.HTTP_ACCEPT,
    "User-Agent": config.HTTP_USER_AGENT,
  });

  const start = performance.now();

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(config.HTTP_TIMEOUT),
      headers,
    });
    log("info", {
      duration_ms: Math.round(performance.now() - start),
      event: "idp.checked",
      idp: idpName,
      status: response.status,
      url,
    });
    return response.status;
  } catch (error) {
    log("error", {
      duration_ms: Math.round(performance.now() - start),
      error,
      event: "idp.unreachable",
      idp: idpName,
      url,
    });
    return 500;
  }
}

export async function createAmqpConnection(amqpUrl: string) {
  log("info", { event: "amqp.connecting" });

  const connection = await amqp.connect([amqpUrl]);

  connection.on("connect", function () {
    log("info", { event: "amqp.connected" });
  });

  connection.on("connectFailed", function ({ err }) {
    log("error", { error: err, event: "amqp.connect_failed" });
  });

  connection.on("disconnect", function ({ err }) {
    log("warn", { error: err, event: "amqp.disconnected" });
  });

  return connection;
}

export function setupMessageConsumer(
  connection: AmqpConnectionManager,
  config: Config,
) {
  const { QUEUE_PRODUCER_NAME, MAP_FI_NAMES_TO_URL, HTTP_TIMEOUT } = config;

  log("info", { event: "idps.configured", idps: MAP_FI_NAMES_TO_URL });
  log("debug", {
    event: "proxy.configured",
    https_proxy: process.env.HTTPS_PROXY,
  });

  const channel_wrapper = connection.createChannel({
    setup: (channel: Channel) => {
      log("info", { event: "amqp.queue_asserted", queue: QUEUE_PRODUCER_NAME });

      return channel.assertQueue(QUEUE_PRODUCER_NAME, { durable: true });
    },
  });

  channel_wrapper.consume(QUEUE_PRODUCER_NAME, async (message) => {
    try {
      // Validate message structure
      if (!message?.content || !message?.properties) {
        log("error", {
          event: "rpc.malformed",
          reason: "missing_content_or_properties",
        });
        channel_wrapper.nack(message, false, false);
        return;
      }

      const { correlationId, replyTo } = message.properties;
      if (!correlationId || !replyTo) {
        log("error", {
          event: "rpc.malformed",
          reason: "missing_correlation_id_or_reply_to",
        });
        channel_wrapper.nack(message, false, false);
        return;
      }

      const idp = message.content.toString("utf8");
      log("debug", {
        correlation_id: correlationId,
        event: "rpc.received",
        idp,
      });

      const status = await checkIdpStatus(idp, config);

      log("debug", {
        correlation_id: correlationId,
        event: "rpc.replied",
        idp,
        status,
      });

      const options = {
        correlationId,
        contentType: "application/json",
        expiration: HTTP_TIMEOUT,
      };

      channel_wrapper.sendToQueue(replyTo, JSON.stringify({ status }), options);
      channel_wrapper.ack(message);
    } catch (error) {
      log("error", { error, event: "rpc.failed" });
      // Don't requeue on processing errors
      channel_wrapper.nack(message, false, false);
    }
  });

  return channel_wrapper;
}
