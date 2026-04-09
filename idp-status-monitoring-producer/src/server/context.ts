//

import type { Config } from "#src/config";
import type {
  AmqpConnectionManager,
  ChannelWrapper,
} from "amqp-connection-manager";
import type { Env } from "hono";

//

export interface ServerContext extends Env {
  Bindings: Config;
  Variables: {
    channelWrapper: ChannelWrapper;
    connection: AmqpConnectionManager | null;
  };
}
