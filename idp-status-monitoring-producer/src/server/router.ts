//

import { log } from "#src/log";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { stream } from "hono/streaming";
import type { StatusCode } from "hono/utils/http-status";
import { v4 as uuid } from "uuid";
import z from "zod";
import type { ServerContext } from "./context";

//

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
  .get("/idp/internet", (c) => {
    const { HTTP_TIMEOUT, IDP_URLS } = c.env;

    return stream(c, async (s) => {
      await Promise.all(
        IDP_URLS.map(async (url) => {
          const start = performance.now();
          try {
            const response = await fetch(url, {
              signal: AbortSignal.timeout(HTTP_TIMEOUT),
            });
            log("info", {
              duration_ms: Math.round(performance.now() - start),
              event: "idp.checked",
              status: response.status,
              url,
            });
            await s.writeln(JSON.stringify({ status: response.status, url }));
          } catch (e) {
            log("warn", {
              duration_ms: Math.round(performance.now() - start),
              error: e,
              event: "idp.unreachable",
              url,
            });
            await s.writeln(
              JSON.stringify({
                status: 0,
                url,
                error: e instanceof Error ? e.message : String(e),
              }),
            );
          }
        }),
      );
    });
  })
  .get(
    "/idp/:name",
    zValidator("param", ParamsSchema),
    async ({ env, req, var: { channelWrapper } }) => {
      const { name } = req.valid("param");

      const { QUEUE_PRODUCER_NAME, HTTP_TIMEOUT } = env;
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
        replyTo: "amq.rabbitmq.reply-to",
        persistent: false,
      });

      const response = await promise;
      clearTimeout(timeoutId);
      return response;
    },
  );
