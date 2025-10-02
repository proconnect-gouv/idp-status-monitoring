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
  connection.createChannel();
  return connection;
}

export function setupMessageConsumer(
  connection: AmqpConnectionManager,
  config: Config,
) {
  const {
    QUEUE_PRODUCER_NAME,
    MAP_FI_NAMES_TO_URL,
    HTTP_TIMEOUT,
    HTTP_USER_AGENT,
    HTTP_ACCEPT,
  } = config;

  const headers = new Headers({
    Accept: HTTP_ACCEPT,
    "User-Agent": HTTP_USER_AGENT,
  });

  console.log(MAP_FI_NAMES_TO_URL);
  console.log(`using proxy : "${process.env.HTTPS_PROXY}"`);

  const channel_wrapper = connection.createChannel({
    setup: (channel: Channel) => {
      console.log(`assertQueue ${QUEUE_PRODUCER_NAME}`);

      return channel.assertQueue(QUEUE_PRODUCER_NAME, { durable: true });
    },
  });

  channel_wrapper.consume(QUEUE_PRODUCER_NAME, async (message) => {
    const idp = message.content.toString("utf8");
    console.log(`received message : ${idp}`);

    let status = 404;

    if (MAP_FI_NAMES_TO_URL.hasOwnProperty(idp)) {
      const url = MAP_FI_NAMES_TO_URL[idp]!;
      console.log(`url : ${url}`);

      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(HTTP_TIMEOUT),
          headers,
        });
        status = response.status;
      } catch (err) {
        console.log(err);
        status = (err as any).response?.status || 500;
      }
    }

    const options = {
      correlationId: message.properties.correlationId,
      contentType: "application/json",
      expiration: HTTP_TIMEOUT,
    };

    console.log(`status : ${status}`);

    channel_wrapper.sendToQueue(
      message.properties.replyTo,
      JSON.stringify({ status }),
      options,
    );
    channel_wrapper.ack(message);
  });

  return channel_wrapper;
}
