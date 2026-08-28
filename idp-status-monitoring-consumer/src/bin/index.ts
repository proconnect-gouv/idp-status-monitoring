//

import { runAudit } from "#src/audit";
import { ConfigSchema } from "#src/config";
import { createAmqpConnection, setupMessageConsumer } from "#src/rpc";
import { createRoutes, type ServerContext } from "#src/server";
import consola from "consola";

const auditIdx = Bun.argv.indexOf("audit");
if (auditIdx !== -1) {
  const hostname = Bun.argv[auditIdx + 1];
  if (!hostname) {
    console.error("Usage: consumer audit <hostname> [port]");
    process.exit(1);
  }
  const port = Bun.argv[auditIdx + 2] ? parseInt(Bun.argv[auditIdx + 2]!, 10) : 443;
  await runAudit(hostname, port);
  process.exit(0);
}

const config = await ConfigSchema.parseAsync(process.env);
consola.level = config.LOG_LEVEL;

consola.info("Starting idp-status-monitoring-consumer...");

const context: ServerContext = { connection: null, config };

const server = Bun.serve({
  port: config.PORT,
  routes: createRoutes(context),
  fetch() {
    return new Response("Not Found", { status: 404 });
  },
});

consola.info(`Consumer started successfully! ${server.url}`);

try {
  context.connection = await createAmqpConnection(config.AMQP_URL);
  setupMessageConsumer(context.connection, config);
} catch (err) {
  consola.error("Failed to connect to AMQP:", err);
}
