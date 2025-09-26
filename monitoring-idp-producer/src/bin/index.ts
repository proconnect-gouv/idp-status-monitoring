//

import { ConfigSchema } from "#src/config";
import { channelWrapper } from "#src/rpc";
import { router } from "#src/server";
import { Hono } from "hono";
import type { ServerContext } from "../server/context";

//

await ConfigSchema.parseAsync(process.env);

//

export default new Hono<ServerContext>()
  .use(({ set }, next) => {
    set("channelWrapper", channelWrapper);
    return next();
  })
  .route("", router);
