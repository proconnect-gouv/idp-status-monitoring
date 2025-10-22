import { expect, test } from "bun:test";
import { createDockerEnv } from "../../tests/docker";

test(
  "IDP Error Handling: Docker build and services start with error-handling configuration",
  async () => {
    await using env = createDockerEnv(import.meta.dir);

    // Start services - this verifies Docker build works
    await env.start({ build: true, quiet: true });

    // Verify all infrastructure services are healthy
    expect(await env.getServiceHealth("rabbitmq")).toBe("healthy");
    expect(await env.getServiceHealth("mock-idp")).toBe("healthy");

    // Verify application services are running
    expect(await env.getServiceState("producer")).toBe("running");
    expect(await env.getServiceState("consumer")).toBe("running");

    // Verify consumer started with correct IDP configuration (healthy, error, not-found)
    const consumerLogs = await env.getServiceLogs("consumer");
    expect(consumerLogs).toContain("Consumer started successfully!");
    expect(consumerLogs).toContain("Connected!");
    expect(consumerLogs).toContain("healthy");
    expect(consumerLogs).toContain("error");
    expect(consumerLogs).toContain("not-found");

    // Verify producer connected to RabbitMQ
    await env.waitForLogMessage("producer", "Connected!");

    // Test the root health endpoint
    const rootResult = await env.execInService(
      "test-runner",
      "curl -s http://producer:3000/",
    );
    expect(rootResult.output).toBe("ok");
  },
  {
    timeout: 120_000,
  },
);
