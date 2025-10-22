import { createDockerEnv } from "#testing/docker";
import { describe, expect, test } from "bun:test";

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
    expect(consumerLogs).toContain("fenris");
    expect(consumerLogs).toContain("prospero");
    expect(consumerLogs).toContain("sorcerers");
  });

  test("📨 Producer: Connected to RabbitMQ", async () => {
    await env.waitForLogMessage("producer", "Connected!");
  });

  test("🏥 GET / - Health check returns ok", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s http://producer:3000/",
    );
    expect(result.output).toBe("ok");
  });

  test("🐺 GET /idp/fenris - RPC to Space Wolves IdP returns 200", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s -w '%{http_code}' http://producer:3000/idp/fenris",
    );
    expect(result.output).toBe("'200'");
  });

  test("💀 GET /idp/prospero - RPC to Thousand Sons IdP returns 500", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s -w '%{http_code}' http://producer:3000/idp/prospero",
    );
    expect(result.output).toBe("'500'");
  });

  test("🌀 GET /idp/sorcerers - RPC to Planet of Sorcerers IdP returns 404", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s -w '%{http_code}' http://producer:3000/idp/sorcerers",
    );
    expect(result.output).toBe("'404'");
  });

  test("📊 GET /idp/internet - Aggregated health includes errors", async () => {
    const result = await env.execInService(
      "test_runner",
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
