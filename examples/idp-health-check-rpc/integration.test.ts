import { describe, expect, test } from "bun:test";
import { createDockerEnv } from "../../tests/docker";

describe("IDP Health Check RPC: End-to-end distributed health monitoring", () => {
  let env: Awaited<ReturnType<typeof createDockerEnv>>;

  test("🚀 Setup: Start Docker services", async () => {
    env = createDockerEnv(import.meta.dir);
    await env.start({ build: true, quiet: true });
  }, 120_000);

  test("🏗️  Infrastructure: RabbitMQ and Mock-IDP are healthy", async () => {
    expect(await env.getServiceHealth("rabbitmq")).toBe("healthy");
    expect(await env.getServiceHealth("mock-idp")).toBe("healthy");
  });

  test("✅ Services: Producer and Consumer are running", async () => {
    expect(await env.getServiceState("producer")).toBe("running");
    expect(await env.getServiceState("consumer")).toBe("running");
  });

  test("📨 Consumer: Connected to RabbitMQ", async () => {
    await env.waitForLogMessage("consumer", "Consumer started successfully!");
    await env.waitForLogMessage("consumer", "Connected!");
    await env.waitForLogMessage("consumer", "assertQueue monitoring-producer");

    const consumerLogs = await env.getServiceLogs("consumer");
    expect(consumerLogs).toContain("test-idp");
    expect(consumerLogs).toContain("another-idp");
  });

  test("📨 Producer: Connected to RabbitMQ", async () => {
    await env.waitForLogMessage("producer", "Connected!");
    await env.waitForLogMessage(
      "producer",
      "assertQueue : monitoring-producer",
    );
    await env.waitForLogMessage(
      "producer",
      "assertQueue : monitoring-consumer",
    );
  });

  test("🏥 GET / - Health check", async () => {
    const result = await env.execInService(
      "test-runner",
      "curl -s http://producer:3000/",
    );
    expect(result.output).toBe("ok");
  });

  test("🔍 GET /idp/test-idp - RPC to healthy IDP", async () => {
    const result = await env.execInService(
      "test-runner",
      "curl -s -w '%{http_code}' http://producer:3000/idp/test-idp",
    );
    const statusCode = result.output.trim().replaceAll("'", "");
    expect(statusCode).toBe("200");
  });

  test("🔍 GET /idp/another-idp - RPC to another healthy IDP", async () => {
    const result = await env.execInService(
      "test-runner",
      "curl -s -w '%{http_code}' http://producer:3000/idp/another-idp",
    );
    const statusCode = result.output.trim().replaceAll("'", "");
    expect(statusCode).toBe("200");
  });

  test("❌ GET /idp/unknown - RPC to unknown IDP", async () => {
    const result = await env.execInService(
      "test-runner",
      "curl -s -w '%{http_code}' http://producer:3000/idp/unknown",
    );
    const statusCode = result.output.trim().replaceAll("'", "");
    expect(statusCode).toBe("404");
  });

  test("📊 GET /idp/internet - Aggregated health check", async () => {
    const result = await env.execInService(
      "test-runner",
      "curl -s http://producer:3000/idp/internet",
    );
    const data = JSON.parse(result.output);
    expect(data.successfuls).toBeDefined();
    expect(data.unsucessfuls).toBeDefined();
    expect(data.successfuls.length).toBeGreaterThan(0);
  });

  test("🧹 Cleanup: Stop all services", async () => {
    await env[Symbol.asyncDispose]();
  }, 30_000);
});
