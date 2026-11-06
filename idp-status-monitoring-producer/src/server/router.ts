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

const READYZ_GRACE_MS = 1_000;

const ReadyzReplySchema = z.object({
  checks: z.array(
    z.discriminatedUnion("ok", [
      z.object({ detail: z.string(), name: z.string(), ok: z.literal(false) }),
      z.object({
        detail: z.string().optional(),
        name: z.string(),
        ok: z.literal(true),
      }),
    ]),
  ),
  status: z.union([z.literal(200), z.literal(404), z.literal(503)]),
});
type ReadyzReply = z.infer<typeof ReadyzReplySchema>;

const rpc_failed = (detail: string): ReadyzReply => ({
  checks: [{ detail, name: "rpc", ok: false }],
  status: 503,
});

const parse_readyz_reply = (reply: string): ReadyzReply => {
  let json: unknown;
  try {
    json = JSON.parse(reply);
  } catch {
    return rpc_failed("invalid reply");
  }
  const parsed = ReadyzReplySchema.safeParse(json);
  if (!parsed.success) return rpc_failed("consumer lacks readyz");
  const { checks, status } = parsed.data;
  return { checks: [{ name: "rpc", ok: true }, ...checks], status };
};

const render_readyz = ({ checks }: ReadyzReply) =>
  [
    ...checks.map((check) =>
      check.ok
        ? `[+]${check.name} ok${check.detail ? `: ${check.detail}` : ""}`
        : `[-]${check.name} failed: ${check.detail}`,
    ),
    `readyz check ${checks.every(({ ok }) => ok) ? "passed" : "failed"}`,
    "",
  ].join("\n");

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
    async ({ env, req, var: { channelWrapper, replies } }) => {
      const { name } = req.valid("param");

      const { QUEUE_PRODUCER_NAME, HTTP_TIMEOUT } = env;
      const correlationId = uuid();

      const { promise, resolve } = Promise.withResolvers<Response>();

      replies.once(correlationId, (reply: string) => {
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
  )
  .get(
    "/idp/:name/readyz",
    zValidator("param", ParamsSchema),
    async ({ env, req, text, var: { channelWrapper, replies } }) => {
      const { name } = req.valid("param");

      const { QUEUE_PRODUCER_NAME, HTTP_TIMEOUT } = env;
      const timeout_ms = HTTP_TIMEOUT + READYZ_GRACE_MS;
      const correlationId = uuid();

      const { promise, resolve } = Promise.withResolvers<ReadyzReply>();

      replies.once(correlationId, (reply: string) => {
        resolve(parse_readyz_reply(reply));
      });

      const timeoutId = setTimeout(() => {
        resolve(rpc_failed(`no reply after ${timeout_ms}ms`));
      }, timeout_ms);

      channelWrapper.sendToQueue(QUEUE_PRODUCER_NAME, name, {
        correlationId,
        expiration: timeout_ms,
        persistent: false,
        replyTo: "amq.rabbitmq.reply-to",
        type: "readyz",
      });

      const reply = await promise;
      clearTimeout(timeoutId);
      replies.removeAllListeners(correlationId);
      return text(render_readyz(reply), reply.status);
    },
  );
