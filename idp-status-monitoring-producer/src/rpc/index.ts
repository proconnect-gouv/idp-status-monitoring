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
  const { QUEUE_CONSUMER_NAME, QUEUE_PRODUCER_NAME } = config;

  const channel_wrapper = connection.createChannel({
    setup: (channel: Channel) => {
      consola.info(`Asserting queue "${QUEUE_PRODUCER_NAME}"`);
      consola.info(`Asserting queue "${QUEUE_CONSUMER_NAME}"`);

      return Promise.all([
        channel.assertQueue(QUEUE_PRODUCER_NAME, { durable: true }),
        channel.assertQueue(QUEUE_CONSUMER_NAME, { durable: true }),
      ]);
    },
  });

  channel_wrapper.setMaxListeners(0);
  channel_wrapper.consume(QUEUE_CONSUMER_NAME, (message) => {
    try {
      // Validate message structure
      if (!message?.content || !message?.properties) {
        consola.error(
          "Malformed message received: missing content or properties",
        );
        channel_wrapper.nack(message, false, false);
        return;
      }

      const { correlationId } = message.properties;
      if (!correlationId) {
        consola.error("Message missing required correlationId property");
        channel_wrapper.nack(message, false, false);
        return;
      }

      const content = message.content.toString("utf8");
      consola.debug(`Received message: ${correlationId} - ${content}`);

      channel_wrapper.emit(correlationId, content);
      channel_wrapper.ack(message);
    } catch (err) {
      consola.error("Error processing message:", err);
      // Don't requeue on processing errors
      channel_wrapper.nack(message, false, false);
    }
  });

  return channel_wrapper;
}
