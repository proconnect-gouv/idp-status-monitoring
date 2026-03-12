//

import { ConfigSchema } from "#src/config";
import { createAmqpConnection, setupMessageConsumer } from "#src/rpc";
import { createRoutes } from "#src/server";

console.log("Starting idp-status-monitoring-consumer...");

// Load configuration
const config = await ConfigSchema.parseAsync(process.env);

// Setup consumer
const connection = await createAmqpConnection(config.AMQP_URL);
setupMessageConsumer(connection, config);

// Health check server for Kubernetes probes
const server = Bun.serve({
  port: config.PORT,
  routes: createRoutes(() => connection.isConnected()),
  fetch() {
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Consumer started successfully! ${server.url}`);
