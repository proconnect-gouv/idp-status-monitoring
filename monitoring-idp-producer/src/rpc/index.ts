//

import { ConfigSchema } from "#src/config";
import amqp from "amqp-connection-manager";

const { AMQP_URL, QUEUE_CONSUMER_NAME, QUEUE_PRODUCER_NAME } =
  await ConfigSchema.parseAsync(process.env);
const connection = amqp.connect([AMQP_URL]);

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

export const channelWrapper = connection.createChannel({
  setup: (channel: any) => {
    console.log(`assertQueue : ${QUEUE_PRODUCER_NAME}`);
    console.log(`assertQueue : ${QUEUE_CONSUMER_NAME}`);

    return Promise.all([
      channel.assertQueue(QUEUE_PRODUCER_NAME, { durable: true }),
      channel.assertQueue(QUEUE_CONSUMER_NAME, { durable: true }),
    ]);
  },
});

channelWrapper.setMaxListeners(0);
channelWrapper.consume(QUEUE_CONSUMER_NAME, (message) => {
  console.log(
    `received message : ${message.properties.correlationId} - ${message.content.toString("utf8")}`,
  );

  channelWrapper.emit(
    message.properties.correlationId,
    message.content.toString("utf8"),
  );
  channelWrapper.ack(message);
});
