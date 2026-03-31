import { createDockerEnv } from "#testing/docker";
import { describe, expect, test } from "bun:test";

describe("IDP Health Check RPC: End-to-end distributed health monitoring", () => {
  const env = createDockerEnv(import.meta.dir);

  test.serial(
    "🚀 Setup: Start Docker services",
    async () => {
      await env.start({ build: true, quiet: true });
    },
    120_000,
  );

  test.serial("📨 Consumer: Loaded Dark Angels configuration", async () => {
    const consumerLogs = await env.getServiceLogs("consumer");
    expect(consumerLogs).toContain("Consumer started successfully!");
    expect(consumerLogs).toContain("rock");
    expect(consumerLogs).toContain("caliban");
  });

  test.serial("📨 Producer: Connected to RabbitMQ", async () => {
    const producerLogs = await env.getServiceLogs("producer");
    expect(producerLogs).toContain("Connected to RabbitMQ");
    expect(producerLogs).toContain('Asserting queue "monitoring-producer"');
  });

  test.serial(
    "🕵️ GET /idp/inner-circle - RPC to Inner Circle secrets",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer/idp/inner-circle",
      );
      expect(result.output).toBe("'200'");
    },
  );

  test.serial(
    "😈 GET /idp/fallen-angels - RPC to track The Fallen",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer/idp/fallen-angels",
      );
      expect(result.output).toBe("'200'");
    },
  );

  test.serial("❌ GET /idp/unknown - RPC to unknown IDP", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s -w '%{http_code}' http://producer/idp/unknown",
    );
    expect(result.output).toBe("'404'");
  });

  test.serial("📊 GET /idp/internet - Aggregated health check", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s http://producer/idp/internet",
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
