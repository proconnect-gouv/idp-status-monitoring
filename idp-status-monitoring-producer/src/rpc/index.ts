//

import { type Config } from "#src/config";
import amqp, {
  type AmqpConnectionManager,
  type Channel,
} from "amqp-connection-manager";
import consola from "consola";

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

export function setupRpcProducer(
  connection: AmqpConnectionManager,
  config: Config,
) {
  const { QUEUE_PRODUCER_NAME } = config;

  const channel_wrapper = connection.createChannel({
    setup: (channel: Channel) => {
      consola.info(`Asserting queue "${QUEUE_PRODUCER_NAME}"`);
      return channel.assertQueue(QUEUE_PRODUCER_NAME, { durable: true });
    },
  });

  channel_wrapper.setMaxListeners(0);
  channel_wrapper.consume(
    "amq.rabbitmq.reply-to",
    (message) => {
      if (!message?.content || !message?.properties) {
        consola.error(
          "Malformed message received: missing content or properties",
        );
        return;
      }

      const { correlationId } = message.properties;
      if (!correlationId) {
        consola.error("Message missing required correlationId property");
        return;
      }

      const content = message.content.toString("utf8");
      consola.debug(`Received message: ${correlationId} - ${content}`);
      channel_wrapper.emit(correlationId, content);
    },
    { noAck: true },
  );

  return channel_wrapper;
}
