//

import { ConfigSchema } from "#src/config";
import { createAmqpConnection, setupRpcProducer } from "#src/rpc";
import { router } from "#src/server";
import { Hono } from "hono";
import type { ServerContext } from "../server/context";

//

const config = await ConfigSchema.parseAsync(process.env);
const connection = await createAmqpConnection(config.AMQP_URL);
const channelWrapper = setupRpcProducer(connection, config);

//

const app = new Hono<ServerContext>();

app.use((context, next) => {
  Object.assign(context.env, config);
  context.set("channelWrapper", channelWrapper);
  return next();
});

app.route("", router);

export default app;
