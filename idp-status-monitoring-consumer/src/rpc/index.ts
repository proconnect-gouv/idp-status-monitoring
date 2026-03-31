//

import { type Config } from "#src/config";
import amqp, {
  type AmqpConnectionManager,
  type Channel,
} from "amqp-connection-manager";
import consola from "consola";

const elapsed = (start: number) => {
  const delta = Date.now() - start;
  return delta < 1000 ? `${delta}ms` : `${Math.round(delta / 1000)}s`;
};

const colorStatus = (status: number) => {
  if (!process.stdout.isTTY) return `${status}`;
  switch ((status / 100) | 0) {
    case 5:
      return `\x1b[31m${status}\x1b[0m`;
    case 4:
      return `\x1b[33m${status}\x1b[0m`;
    case 3:
      return `\x1b[36m${status}\x1b[0m`;
    case 2:
      return `\x1b[32m${status}\x1b[0m`;
    default:
      return `${status}`;
  }
};

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

  const start = Date.now();
  consola.log(`--> GET ${url}`);

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(config.HTTP_TIMEOUT),
      headers,
    });
    consola.log(
      `<-- GET ${url} ${colorStatus(response.status)} ${elapsed(start)}`,
    );
    return response.status;
  } catch (err) {
    consola.error(`xxx GET ${url} ${elapsed(start)}`, err);
    return 500;
  }
}

export async function createAmqpConnection(amqpUrl: string) {
  consola.info("Connecting to RabbitMQ...");

  const connection = await amqp.connect([amqpUrl]);

  connection.on("connect", function () {
    consola.info("Connected to RabbitMQ");
  });

  connection.on("connectFailed", function (err) {
    consola.error("Failed to connect to RabbitMQ", err);
  });

  connection.on("disconnect", function (err) {
    consola.warn("Disconnected from RabbitMQ", err);
  });

  return connection;
}

export function setupMessageConsumer(
  connection: AmqpConnectionManager,
  config: Config,
) {
  const { QUEUE_PRODUCER_NAME, MAP_FI_NAMES_TO_URL, HTTP_TIMEOUT } = config;

  consola.info("IDP URL map:", MAP_FI_NAMES_TO_URL);
  consola.debug(`Using proxy: "${process.env.HTTPS_PROXY}"`);

  const channel_wrapper = connection.createChannel({
    setup: (channel: Channel) => {
      consola.info(`Asserting queue "${QUEUE_PRODUCER_NAME}"`);

      return channel.assertQueue(QUEUE_PRODUCER_NAME, { durable: true });
    },
  });

  channel_wrapper.consume(QUEUE_PRODUCER_NAME, async (message) => {
    try {
      // Validate message structure
      if (!message?.content || !message?.properties) {
        consola.error(
          "Malformed message received: missing content or properties",
        );
        channel_wrapper.nack(message, false, false);
        return;
      }

      const { correlationId, replyTo } = message.properties;
      if (!correlationId || !replyTo) {
        consola.error(
          "Message missing required properties (correlationId or replyTo)",
        );
        channel_wrapper.nack(message, false, false);
        return;
      }

      const idp = message.content.toString("utf8");
      consola.debug(
        `Received message: ${idp} (correlationId: ${correlationId})`,
      );

      const status = await checkIdpStatus(idp, config);

      consola.debug(`Status for ${idp}: ${status}`);

      const options = {
        correlationId,
        contentType: "application/json",
        expiration: HTTP_TIMEOUT,
      };

      channel_wrapper.sendToQueue(replyTo, JSON.stringify({ status }), options);
      channel_wrapper.ack(message);
    } catch (err) {
      consola.error("Error processing message:", err);
      // Don't requeue on processing errors
      channel_wrapper.nack(message, false, false);
    }
  });

  return channel_wrapper;
}
