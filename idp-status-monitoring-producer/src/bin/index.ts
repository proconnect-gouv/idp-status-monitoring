//

import { ConfigSchema } from "#src/config";
import { createAmqpConnection, setupRpcProducer } from "#src/rpc";
import { router } from "#src/server";
import consola from "consola";
import { Hono } from "hono";
import { logger } from "hono/logger";
import type { ServerContext } from "../server/context";

//

const config = await ConfigSchema.parseAsync(process.env);
consola.level = config.LOG_LEVEL;
const connection = await createAmqpConnection(config.AMQP_URL);
const channelWrapper = setupRpcProducer(connection, config);

//

const app = new Hono<ServerContext>()
  .use(logger((str) => consola.log(str)))
  .use((context, next) => {
    Object.assign(context.env, config);
    context.set("channelWrapper", channelWrapper);
    return next();
  })
  .route("", router);

export default {
  fetch: app.fetch,
  port: config.PORT,
};
