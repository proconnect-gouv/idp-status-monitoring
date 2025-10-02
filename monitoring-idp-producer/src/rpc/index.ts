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
    console.log(
      `received message : ${message.properties.correlationId} - ${message.content.toString("utf8")}`,
    );

    channel_wrapper.emit(
      message.properties.correlationId,
      message.content.toString("utf8"),
    );
    channel_wrapper.ack(message);
  });

  return channel_wrapper;
}
