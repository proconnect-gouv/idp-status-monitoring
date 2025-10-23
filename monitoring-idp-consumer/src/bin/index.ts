//

import { ConfigSchema } from "#src/config";
import { createAmqpConnection, setupMessageConsumer } from "#src/rpc";

console.log("Starting monitoring-idp-consumer...");

// Load configuration
const config = await ConfigSchema.parseAsync(process.env);

// Setup consumer
const connection = await createAmqpConnection(config.AMQP_URL);
setupMessageConsumer(connection, config);

// Health check server for Kubernetes probes
const server = Bun.serve({
  port: 3000,
  routes: {
    // Liveness probe - checks if the application is alive
    "/health/live": () => Response.json({ status: "alive" }),

    // Readiness probe - checks if the application is ready to serve traffic
    "/health/ready": () => {
      // Check if AMQP connection is ready
      const isConnected = connection.isConnected();

      if (isConnected) {
        return Response.json({ status: "ready", amqp: "connected" });
      } else {
        return new Response(
          JSON.stringify({ status: "not ready", amqp: "disconnected" }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    },

    // Startup probe - checks if the application has started successfully
    "/health/startup": () => Response.json({ status: "started" }),

    // Default health endpoint
    "/health": () =>
      Response.json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      }),
  },
  fetch() {
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Consumer started successfully! ${server.url}`);
