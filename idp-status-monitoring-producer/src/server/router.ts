//

import { zValidator } from "@hono/zod-validator";
import consola from "consola";
import { Hono } from "hono";
import type { StatusCode } from "hono/utils/http-status";
import { v4 as uuid } from "uuid";
import z from "zod";
import type { ServerContext } from "./context";

//

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

const ParamsSchema = z.object({
  name: z.string().min(1),
});

export const router = new Hono<ServerContext>()
  .get("/", ({ text }) => {
    return text("ok");
  })
  .get("/livez", ({ json }) => json({ status: "alive" }))
  .get("/healthz", ({ json }) =>
    json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }),
  )
  .get("/readyz", ({ var: { connection }, json }) => {
    const isConnected = connection?.isConnected() ?? false;
    return json(
      {
        status: isConnected ? "ready" : "not ready",
        amqp: isConnected ? "connected" : "disconnected",
      },
      isConnected ? 200 : 503,
    );
  })
  .get("/idp/internet", async ({ env, json, status }) => {
    const { HTTP_TIMEOUT, IDP_URLS } = env;

    const requests = IDP_URLS.map(async (url) => {
      const start = Date.now();
      consola.log(`--> GET ${url}`);
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(HTTP_TIMEOUT),
        });
        consola.log(
          `<-- GET ${url} ${colorStatus(response.status)} ${elapsed(start)}`,
        );
        return {
          status: response.status,
          url,
        };
      } catch (e) {
        consola.warn(`xxx GET ${url} ${elapsed(start)}`, e);
        return {
          status: 0,
          url,
          error: e instanceof Error ? e.message : String(e),
        };
      }
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
        try {
          const response = JSON.parse(reply) as { status: StatusCode };
          resolve(new Response(null, { status: response.status || 500 }));
        } catch {
          resolve(new Response(null, { status: 500 }));
        }
      });

      const timeoutId = setTimeout(() => {
        resolve(new Response(null, { status: 503 }));
      }, HTTP_TIMEOUT);

      channelWrapper.sendToQueue(QUEUE_PRODUCER_NAME, name, {
        correlationId,
        expiration: HTTP_TIMEOUT,
        replyTo: QUEUE_CONSUMER_NAME,
        persistent: false,
      });

      const response = await promise;
      clearTimeout(timeoutId);
      return response;
    },
  );
