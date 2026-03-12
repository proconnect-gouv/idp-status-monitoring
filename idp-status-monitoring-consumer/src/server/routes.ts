//

export function createRoutes(getConnectionStatus: () => boolean) {
  return {
    "/health/live": () => Response.json({ status: "alive" }),

    "/health/startup": () => Response.json({ status: "started" }),

    "/health": () =>
      Response.json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      }),

    "/health/ready": () => {
      const isConnected = getConnectionStatus();
      return Response.json(
        {
          status: isConnected ? "ready" : "not ready",
          amqp: isConnected ? "connected" : "disconnected",
        },
        { status: isConnected ? 200 : 503 },
      );
    },
  };
}
