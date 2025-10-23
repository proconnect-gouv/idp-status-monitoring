//

import { type Config } from "#src/config";
import amqp, {
  type AmqpConnectionManager,
  type Channel,
} from "amqp-connection-manager";

export async function createAmqpConnection(amqpUrl: string) {
  console.log("connect to RabbitMQ");

  const connection = await amqp.connect([amqpUrl]);

  connection.on("connect", function () {
    console.log("Connected!");
  });

  connection.on("connectFailed", function (err) {
    console.log(err);
    console.log("Failed to connect!");
  });

  connection.on("disconnect", function (err) {
    console.log("Disconnected.", err);
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
      console.log(`assertQueue : ${QUEUE_PRODUCER_NAME}`);
      console.log(`assertQueue : ${QUEUE_CONSUMER_NAME}`);

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
        console.error(
          "Malformed message received: missing content or properties",
        );
        channel_wrapper.nack(message, false, false);
        return;
      }

      const { correlationId } = message.properties;
      if (!correlationId) {
        console.error("Message missing required correlationId property");
        channel_wrapper.nack(message, false, false);
        return;
      }

      const content = message.content.toString("utf8");
      console.log(`received message : ${correlationId} - ${content}`);

      channel_wrapper.emit(correlationId, content);
      channel_wrapper.ack(message);
    } catch (err) {
      console.error("Error processing message:", err);
      // Don't requeue on processing errors
      channel_wrapper.nack(message, false, false);
    }
  });

  return channel_wrapper;
}
