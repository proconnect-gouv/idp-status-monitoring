//

import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { logger } from "hono/logger";
import type { StatusCode } from "hono/utils/http-status";
import { v4 as uuid } from "uuid";
import z from "zod";
import type { ServerContext } from "./context";

//

const ParamsSchema = z.object({
  name: z.string().min(1),
});

export const router = new Hono<ServerContext>()
  .use(logger())
  .get("/", ({ text }) => {
    return text("ok");
  })
  .get("/idp/internet", async ({ env, json, status }) => {
    const { IDP_URLS } = env;

    const requests = IDP_URLS.map(async (url) => {
      const response = await fetch(url);
      return {
        status: response.status,
        url,
      };
    });
    const responses = await Promise.all(requests);

    const successfuls = responses.filter(
      (response) => response.status >= 200 && response.status < 400,
    );

    const unsucessfuls = responses.filter(
      (response) => response.status < 200 || response.status >= 400,
    );

    status(unsucessfuls.length < successfuls.length ? 200 : 503);

    return json({
      successfuls,
      unsucessfuls,
    });
  })
  .get(
    "/idp/:name",
    zValidator("param", ParamsSchema),
    async ({ env, req, var: { channelWrapper } }) => {
      const { name } = req.valid("param");

      const { QUEUE_CONSUMER_NAME, QUEUE_PRODUCER_NAME, HTTP_TIMEOUT } = env;
      const correlationId = uuid();

      const { promise, resolve } = Promise.withResolvers<Response>();

      channelWrapper.once(correlationId, (reply) => {
        console.log(`received response : ${reply}`);
        try {
          const response = JSON.parse(reply) as { status: StatusCode };
          resolve(new Response(null, { status: response.status || 500 }));
        } catch {
          resolve(new Response(null, { status: 500 }));
        }
      });

      setTimeout(() => {
        resolve(new Response(null, { status: 503 }));
      }, HTTP_TIMEOUT);

      channelWrapper.sendToQueue(QUEUE_PRODUCER_NAME, name, {
        correlationId,
        expiration: HTTP_TIMEOUT,
        replyTo: QUEUE_CONSUMER_NAME,
        persistent: false,
      });

      return promise;
    },
  );
