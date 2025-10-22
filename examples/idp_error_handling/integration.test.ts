import { describe, expect, test } from "bun:test";
import { createDockerEnv } from "../../tests/docker";

describe("IDP Error Handling: Graceful handling of various error scenarios", () => {
  let env: Awaited<ReturnType<typeof createDockerEnv>>;

  test("🚀 Setup: Start Docker services with error-handling config", async () => {
    env = createDockerEnv(import.meta.dir);
    await env.start({ build: true, quiet: true });
  }, 120_000);

  test("✅ Services: Producer and Consumer are running", async () => {
    expect(await env.getServiceState("producer")).toBe("running");
    expect(await env.getServiceState("consumer")).toBe("running");
  });

  test("📨 Consumer: Started with error-handling configuration", async () => {
    const consumerLogs = await env.getServiceLogs("consumer");
    expect(consumerLogs).toContain("Consumer started successfully!");
    expect(consumerLogs).toContain("Connected!");
    expect(consumerLogs).toContain("healthy");
    expect(consumerLogs).toContain("error");
    expect(consumerLogs).toContain("not-found");
  });

  test("📨 Producer: Connected to RabbitMQ", async () => {
    await env.waitForLogMessage("producer", "Connected!");
  });

  test("🏥 GET / - Health check returns ok", async () => {
    const result = await env.execInService(
      "test-runner",
      "curl -s http://producer:3000/",
    );
    expect(result.output).toBe("ok");
  });

  test("✅ GET /idp/healthy - RPC to healthy IDP returns 200", async () => {
    const result = await env.execInService(
      "test-runner",
      "curl -s -w '%{http_code}' http://producer:3000/idp/healthy",
    );
    expect(result.output).toBe("'200'");
  });

  test("⚠️  GET /idp/error - RPC to error IDP returns 500", async () => {
    const result = await env.execInService(
      "test-runner",
      "curl -s -w '%{http_code}' http://producer:3000/idp/error",
    );
    expect(result.output).toBe("'500'");
  });

  test("❌ GET /idp/not-found - RPC to not-found IDP returns 404", async () => {
    const result = await env.execInService(
      "test-runner",
      "curl -s -w '%{http_code}' http://producer:3000/idp/not-found",
    );
    expect(result.output).toBe("'404'");
  });

  test("📊 GET /idp/internet - Aggregated health includes errors", async () => {
    const result = await env.execInService(
      "test-runner",
      "curl -s http://producer:3000/idp/internet",
    );
    const data = JSON.parse(result.output);
    expect(data.successfuls).toBeDefined();
    expect(data.unsucessfuls).toBeDefined();
    expect(data.successfuls.length).toBeGreaterThan(0);
    expect(data.unsucessfuls.length).toBeGreaterThan(0);
  });

  test("🧹 Cleanup: Stop all services", async () => {
    await env[Symbol.asyncDispose]();
  }, 30_000);
});
