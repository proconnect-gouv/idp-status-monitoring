//

import type { Config } from "#src/config";
import type { ChannelWrapper } from "amqp-connection-manager";
import type { Env } from "hono";

//

export interface ServerContext extends Env {
  Bindings: Config;
  Variables: {
    channelWrapper: ChannelWrapper;
  };
}
