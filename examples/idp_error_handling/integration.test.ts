import { expect, test } from "bun:test";
import { createDockerEnv } from "../../tests/docker";

test(
  "IDP Error Handling: System starts up successfully",
  async () => {
    await using env = createDockerEnv(import.meta.dir);

    // Start services
    await env.start({ build: true });

    // Verify RabbitMQ is healthy
    expect(await env.getServiceHealth("rabbitmq")).toBe("healthy");

    // Verify mock-idp is healthy
    expect(await env.getServiceHealth("mock-idp")).toBe("healthy");

    // Verify producer is running
    expect(await env.getServiceState("producer")).toBe("running");

    // Verify consumer is running
    expect(await env.getServiceState("consumer")).toBe("running");

    // Verify consumer started successfully
    const consumerLogs = await env.getServiceLogs("consumer");
    expect(consumerLogs).toMatchInlineSnapshot(`
      "consumer-1  | Starting monitoring-idp-consumer...
      consumer-1  | connect to RabbitMQ
      consumer-1  | {
      consumer-1  |   healthy: "http://mock-idp/idp/healthy",
      consumer-1  |   error: "http://mock-idp/idp/error",
      consumer-1  |   "not-found": "http://mock-idp/idp/not-found",
      consumer-1  | }
      consumer-1  | using proxy : "undefined"
      consumer-1  | Consumer started successfully!
      consumer-1  | Connected!
      consumer-1  | assertQueue monitoring-producer
      "
    `);
  },
  {
    timeout: 120_000,
  },
);
