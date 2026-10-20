//

import { type Config } from "#src/config";
import { log } from "#src/log";
import amqp, {
  type AmqpConnectionManager,
  type Channel,
} from "amqp-connection-manager";

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

export function setupRpcProducer(
  connection: AmqpConnectionManager,
  config: Config,
) {
  const { QUEUE_PRODUCER_NAME } = config;

  const channel_wrapper = connection.createChannel({
    setup: (channel: Channel) => {
      log("info", { event: "amqp.queue_asserted", queue: QUEUE_PRODUCER_NAME });
      return channel.assertQueue(QUEUE_PRODUCER_NAME, { durable: true });
    },
  });

  channel_wrapper.setMaxListeners(0);
  channel_wrapper.consume(
    "amq.rabbitmq.reply-to",
    (message) => {
      if (!message?.content || !message?.properties) {
        log("error", {
          event: "rpc.malformed",
          reason: "missing_content_or_properties",
        });
        return;
      }

      const { correlationId } = message.properties;
      if (!correlationId) {
        log("error", {
          event: "rpc.malformed",
          reason: "missing_correlation_id",
        });
        return;
      }

      const content = message.content.toString("utf8");
      log("debug", {
        content,
        correlation_id: correlationId,
        event: "rpc.reply_received",
      });
      channel_wrapper.emit(correlationId, content);
    },
    { noAck: true },
  );

  return channel_wrapper;
}
