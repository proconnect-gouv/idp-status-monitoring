//

import { ConfigSchema } from "#src/config";
import { createAmqpConnection, setupMessageConsumer } from "#src/rpc";
import { createRoutes } from "#src/server";
import consola from "consola";

// Load configuration
const config = await ConfigSchema.parseAsync(process.env);
consola.level = config.LOG_LEVEL;

consola.info("Starting idp-status-monitoring-consumer...");

// Setup consumer
const connection = await createAmqpConnection(config.AMQP_URL);
setupMessageConsumer(connection, config);

// Health check server for Kubernetes probes
const server = Bun.serve({
  port: config.PORT,
  routes: createRoutes(() => connection.isConnected(), config),
  fetch() {
    return new Response("Not Found", { status: 404 });
  },
});

consola.info(`Consumer started successfully! ${server.url}`);
