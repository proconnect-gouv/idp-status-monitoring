import { createDockerEnv } from "#testing/docker";
import { describe, expect, test } from "bun:test";

describe("IDP Resilience: RabbitMQ failure graceful degradation", () => {
  const env = createDockerEnv(import.meta.dir);

  test.serial(
    "🚀 Setup: Start Docker services with Ultramarines IdPs",
    async () => {
      await env.start({ build: true, quiet: true });
    },
    120_000,
  );

  test.serial("📨 Consumer: Loaded Ultramarines configuration", async () => {
    const consumerLogs = await env.getServiceLogs("consumer");
    expect(consumerLogs).toContain("Consumer started successfully!");
    expect(consumerLogs).toContain("macragge");
    expect(consumerLogs).toContain("calth");
  });

  test.serial("📨 Producer: Connected to RabbitMQ", async () => {
    const producerLogs = await env.getServiceLogs("producer");
    expect(producerLogs).toContain("Connected!");
    expect(producerLogs).toContain("assertQueue : monitoring-producer");
  });

  test.serial(
    "⚔️ GET /idp/macragge - RPC-based health check working",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer/idp/macragge",
      );
      expect(result.output).toBe("'200'");
    },
  );

  test.serial(
    "📊 GET /idp/internet - Direct health aggregation working",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer/idp/internet",
      );
      const statusCode = result.output.match(/'(\d+)'/)?.[1];
      expect(statusCode).toBe("200");
    },
  );

  test.serial(
    "🐰 Stop RabbitMQ - Simulating message queue failure",
    async () => {
      await env.stopService("rabbitmq");
    },
  );

  test.serial(
    "⚠️ GET /idp/macragge - RPC fails gracefully when RabbitMQ down (503)",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer/idp/macragge",
      );
      expect(result.output).toBe("'503'");
    },
    15_000,
  );

  test.serial(
    "✅ GET /idp/internet - Direct checks still work without RabbitMQ",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer/idp/internet",
      );
      const statusCode = result.output.match(/'(\d+)'/)?.[1];
      expect(statusCode).toBe("200");

      const jsonOutput = result.output.replace(/'200'/, "").trim();
      const responseJson = JSON.parse(jsonOutput);
      expect(responseJson).toMatchInlineSnapshot(`
        {
          "successfuls": [
            {
              "status": 200,
              "url": "http://auth.macragge.ultramarines",
            },
            {
              "status": 200,
              "url": "http://auth.calth.ultramarines",
            },
          ],
          "unsucessfuls": [],
        }
      `);
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
