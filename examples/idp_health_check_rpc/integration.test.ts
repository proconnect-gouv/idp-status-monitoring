import { createDockerEnv } from "#testing/docker";
import { describe, expect, test } from "bun:test";

describe("IDP Health Check RPC: End-to-end distributed health monitoring", () => {
  let env: Awaited<ReturnType<typeof createDockerEnv>>;

  test.serial(
    "🚀 Setup: Start Docker services",
    async () => {
      env = createDockerEnv(import.meta.dir);
      await env.start({ build: true, quiet: true });
    },
    120_000,
  );

  test.serial("📨 Consumer: Connected to RabbitMQ", async () => {
    await env.waitForLogMessage("consumer", "Consumer started successfully!");
    await env.waitForLogMessage("consumer", "Connected!");
    await env.waitForLogMessage("consumer", "assertQueue monitoring-producer");

    const consumerLogs = await env.getServiceLogs("consumer");
    expect(consumerLogs).toContain("rock");
    expect(consumerLogs).toContain("caliban");
  });

  test.serial("📨 Producer: Connected to RabbitMQ", async () => {
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

  test.serial("🏥 GET / - Health check", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s http://producer:3000/",
    );
    expect(result.output).toBe("ok");
  });

  test.serial(
    "🕵️ GET /idp/inner-circle - RPC to Inner Circle secrets",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer:3000/idp/inner-circle",
      );
      expect(result.output).toBe("'200'");
    },
  );

  test.serial(
    "😈 GET /idp/fallen-angels - RPC to track The Fallen",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer:3000/idp/fallen-angels",
      );
      expect(result.output).toBe("'200'");
    },
  );

  test.serial("❌ GET /idp/unknown - RPC to unknown IDP", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s -w '%{http_code}' http://producer:3000/idp/unknown",
    );
    expect(result.output).toBe("'404'");
  });

  test.serial("📊 GET /idp/internet - Aggregated health check", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s http://producer:3000/idp/internet",
    );
    const data = JSON.parse(result.output);
    expect(data.successfuls).toBeDefined();
    expect(data.unsucessfuls).toBeDefined();
    expect(data.successfuls.length).toBeGreaterThan(0);
  });

  test.serial(
    "🧹 Cleanup: Stop all services",
    async () => {
      await env[Symbol.asyncDispose]();
    },
    30_000,
  );
});
