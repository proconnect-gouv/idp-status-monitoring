import { createDockerEnv } from "#testing/docker";
import { describe, expect, test } from "bun:test";

describe("IDP Cascading Failures: Tyranid Hive Fleet resilience testing", () => {
  const env = createDockerEnv(import.meta.dir);

  test.serial(
    "🚀 Setup: Start Docker services with Tyranid Hive Fleets",
    async () => {
      await env.start({ build: true, quiet: true });
    },
    120_000,
  );

  test.serial("📨 Consumer: Loaded all Hive Fleet configuration", async () => {
    await env.waitForLogMessage("consumer", "Consumer started successfully!");

    const consumerLogs = await env.getServiceLogs("consumer");
    expect(consumerLogs).toContain("kraken");
    expect(consumerLogs).toContain("leviathan");
    expect(consumerLogs).toContain("behemoth");
  });

  test.serial("📨 Producer: Connected to RabbitMQ", async () => {
    await env.waitForLogMessage("producer", "Connected!");

    const producerLogs = await env.getServiceLogs("producer");
    expect(producerLogs).toContain("assertQueue : monitoring-producer");
  });

  test.serial("🏥 GET / - Health check", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s http://producer:3000/",
    );
    expect(result.output).toBe("ok");
  });

  test.serial(
    "🦂 GET /idp/kraken - Hive Fleet Kraken consuming biomass",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer:3000/idp/kraken",
      );
      expect(result.output).toBe("'200'");
    },
  );

  test.serial(
    "🦂 GET /idp/leviathan - Hive Fleet Leviathan assimilating protocols",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer:3000/idp/leviathan",
      );
      expect(result.output).toBe("'200'");
    },
  );

  test.serial(
    "🦂 GET /idp/behemoth - Hive Fleet Behemoth absorbing passwords",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer:3000/idp/behemoth",
      );
      expect(result.output).toBe("'200'");
    },
  );

  test.serial(
    "📊 GET /idp/internet - All Hive Fleets operational (200)",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer:3000/idp/internet",
      );
      const statusCode = result.output.match(/'(\d+)'/)?.[1];
      expect(statusCode).toBe("200");

      const jsonPart = result.output.replace(/'200'/, "");
      const data = JSON.parse(jsonPart);
      expect(data.successfuls).toBeDefined();
      expect(data.successfuls.length).toBe(3);
      expect(data.unsucessfuls.length).toBe(0);
    },
  );

  test.serial(
    "❌ GET /idp/unknown - Unknown Hive Fleet returns 404",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer:3000/idp/unknown",
      );
      expect(result.output).toBe("'404'");
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
