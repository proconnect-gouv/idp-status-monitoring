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

export default new Hono<ServerContext>()
  .use(({ set }, next) => {
    set("channelWrapper", channelWrapper);
    return next();
  })
  .route("", router);
