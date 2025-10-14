import { expect, test } from "bun:test";
import { createDockerEnv } from "../../tests/docker";

test(
  "Producer-Consumer Integration: Services start and communicate successfully",
  async () => {
    await using env = createDockerEnv(import.meta.dir);

    // Start services
    await env.start({ build: true, quiet: true });

    // Verify RabbitMQ is healthy
    expect(await env.getServiceHealth("rabbitmq")).toBe("healthy");

    // Verify producer is running
    expect(await env.getServiceState("producer")).toBe("running");

    // Verify consumer is running
    expect(await env.getServiceState("consumer")).toBe("running");

    // Verify consumer started successfully
    const consumerLogs1 = await env.getServiceLogs("consumer");
    expect(consumerLogs1).toContain("Consumer started successfully!");

    // Trigger a test message
    await env.execInService(
      "test-runner",
      "curl -X POST http://producer:3000/idp/test-idp",
    );

    // Wait for consumer to receive and process the message
    await env.waitForLogMessage("consumer", "Received test message");
  },
  {
    timeout: 120_000,
  },
);
