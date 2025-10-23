import { createDockerEnv } from "#testing/docker";
import { describe, expect, test } from "bun:test";

describe("IDP Error Handling: Graceful handling of various error scenarios", () => {
  const env = createDockerEnv(import.meta.dir);

  test.serial(
    "🚀 Setup: Start Docker services with error-handling config",
    async () => {
      await env.start({ build: true, quiet: true });
    },
    120_000,
  );

  test.serial("📨 Consumer: Loaded error-handling configuration", async () => {
    const consumerLogs = await env.getServiceLogs("consumer");
    expect(consumerLogs).toContain("Consumer started successfully!");
    expect(consumerLogs).toContain("fenris");
    expect(consumerLogs).toContain("prospero");
    expect(consumerLogs).toContain("sorcerers");
  });

  test.serial("📨 Producer: Connected to RabbitMQ", async () => {
    const producerLogs = await env.getServiceLogs("producer");
    expect(producerLogs).toContain("Connected!");
    expect(producerLogs).toContain("assertQueue : monitoring-producer");
  });

  test.serial(
    "🐺 GET /idp/fenris - RPC to Space Wolves IdP returns 200",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer/idp/fenris",
      );
      expect(result.output).toBe("'200'");
    },
  );

  test.serial(
    "💀 GET /idp/prospero - RPC to Thousand Sons IdP returns 500",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer/idp/prospero",
      );
      expect(result.output).toBe("'500'");
    },
  );

  test.serial(
    "🌀 GET /idp/sorcerers - RPC to Planet of Sorcerers IdP returns 404",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer/idp/sorcerers",
      );
      expect(result.output).toBe("'404'");
    },
  );

  test.serial(
    "📊 GET /idp/internet - Aggregated health includes errors",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s http://producer/idp/internet",
      );
      const data = JSON.parse(result.output);
      expect(data.successfuls).toBeDefined();
      expect(data.unsucessfuls).toBeDefined();
      expect(data.successfuls.length).toBeGreaterThan(0);
      expect(data.unsucessfuls.length).toBeGreaterThan(0);
    },
  );

  test.serial(
    "🧹 Cleanup: Stop all services",
    async () => {
      await env[Symbol.asyncDispose]();
    },
    30_000,
  );
});
