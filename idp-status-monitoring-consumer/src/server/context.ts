//

import type { Config } from "#src/config";
import type { AmqpConnectionManager } from "amqp-connection-manager";

export interface ServerContext {
  connection: AmqpConnectionManager | null;
  config: Config;
}
