//

import { ConfigSchema } from "#src/config";
import { log, set_log_level } from "#src/log";
import { createAmqpConnection, setupRpcProducer } from "#src/rpc";
import { router } from "#src/server";
import { Hono } from "hono";
import type { ServerContext } from "../server/context";

//

const config = await ConfigSchema.parseAsync(process.env);
set_log_level(config.LOG_LEVEL);
const connection = await createAmqpConnection(config.AMQP_URL);
const channelWrapper = setupRpcProducer(connection, config);

//

const app = new Hono<ServerContext>()
  .use(async (c, next) => {
    const start = performance.now();
    await next();
    log("info", {
      duration_ms: Math.round(performance.now() - start),
      event: "http.request",
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
    });
  })
  .use((context, next) => {
    Object.assign(context.env, config);
    context.set("channelWrapper", channelWrapper);
    context.set("connection", connection);
    return next();
  })
  .route("", router);

const server = Bun.serve({
  fetch: app.fetch,
  port: config.PORT,
});

log("info", { event: "producer.started", url: server.url.href });
