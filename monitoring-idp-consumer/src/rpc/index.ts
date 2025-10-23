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
    try {
      // Validate message structure
      if (!message?.content || !message?.properties) {
        console.error(
          "Malformed message received: missing content or properties",
        );
        channel_wrapper.nack(message, false, false);
        return;
      }

      const { correlationId, replyTo } = message.properties;
      if (!correlationId || !replyTo) {
        console.error(
          "Message missing required properties (correlationId or replyTo)",
        );
        channel_wrapper.nack(message, false, false);
        return;
      }

      const idp = message.content.toString("utf8");
      console.log(`received message : ${idp}`);

      let status = 404;

      if (Object.hasOwn(MAP_FI_NAMES_TO_URL, idp)) {
        const url = MAP_FI_NAMES_TO_URL[idp]!;
        console.log(`url : ${url}`);

        try {
          const response = await fetch(url, {
            signal: AbortSignal.timeout(HTTP_TIMEOUT),
            headers,
          });
          status = response.status;
        } catch (err) {
          console.error("Fetch error:", err);
          status = 500;
        }
      }

      const options = {
        correlationId,
        contentType: "application/json",
        expiration: HTTP_TIMEOUT,
      };

      console.log(`status : ${status}`);

      channel_wrapper.sendToQueue(replyTo, JSON.stringify({ status }), options);
      channel_wrapper.ack(message);
    } catch (err) {
      console.error("Error processing message:", err);
      // Don't requeue on processing errors
      channel_wrapper.nack(message, false, false);
    }
  });

  return channel_wrapper;
}
