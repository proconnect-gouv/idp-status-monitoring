//

import { ConfigSchema } from "#src/config";
import { log, set_log_level } from "#src/log";
import { createAmqpConnection, setupMessageConsumer } from "#src/rpc";
import { createRoutes, type ServerContext } from "#src/server";

const config = await ConfigSchema.parseAsync(process.env);
set_log_level(config.LOG_LEVEL);

const context: ServerContext = { connection: null, config };

const server = Bun.serve({
  port: config.PORT,
  routes: createRoutes(context),
  fetch() {
    return new Response("Not Found", { status: 404 });
  },
});

log("info", { event: "consumer.started", url: server.url.href });

try {
  context.connection = await createAmqpConnection(config.AMQP_URL);
  setupMessageConsumer(context.connection, config);
} catch (error) {
  log("error", { error, event: "amqp.connect_failed" });
}
