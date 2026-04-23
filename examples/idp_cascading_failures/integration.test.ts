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
    const consumerLogs = await env.getServiceLogs("consumer");
    expect(consumerLogs).toContain("Consumer started successfully!");
    expect(consumerLogs).toContain("kraken");
    expect(consumerLogs).toContain("leviathan");
    expect(consumerLogs).toContain("behemoth");
  });

  test.serial("📨 Producer: Connected to RabbitMQ", async () => {
    const producerLogs = await env.getServiceLogs("producer");
    expect(producerLogs).toContain("Connected to RabbitMQ");
    expect(producerLogs).toContain('Asserting queue "monitoring-producer"');
  });

  test.serial(
    "🦂 GET /idp/kraken - Hive Fleet Kraken consuming biomass",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer/idp/kraken",
      );
      expect(result.output).toBe("'200'");
    },
  );

  test.serial(
    "🦂 GET /idp/leviathan - Hive Fleet Leviathan assimilating protocols",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer/idp/leviathan",
      );
      expect(result.output).toBe("'200'");
    },
  );

  test.serial(
    "🦂 GET /idp/behemoth - Hive Fleet Behemoth absorbing passwords",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer/idp/behemoth",
      );
      expect(result.output).toBe("'200'");
    },
  );

  test.serial(
    "📊 GET /idp/internet - All Hive Fleets operational (200)",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s http://producer/idp/internet",
      );
      const lines = result.output
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line: string) => JSON.parse(line))
        .sort((a: { url: string }, b: { url: string }) =>
          a.url.localeCompare(b.url),
        );
      expect(lines).toMatchInlineSnapshot(`
        [
          {
            "status": 200,
            "url": "http://auth.behemoth.tyranids",
          },
          {
            "status": 200,
            "url": "http://auth.kraken.tyranids",
          },
          {
            "status": 200,
            "url": "http://auth.leviathan.tyranids",
          },
        ]
      `);
    },
  );

  test.serial("🦑 Stop Behemoth Hive Fleet", async () => {
    await env.stopService("auth.behemoth.tyranids");
  });

  test.serial(
    "📊 GET /idp/internet - 2/3 Hive Fleets operational (200)",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer/idp/internet",
      );
      const statusCode = result.output.match(/'(\d+)'/)?.[1];
      expect(statusCode).toBe("200");
    },
  );

  test.serial("🦑 Stop Leviathan Hive Fleet", async () => {
    await env.stopService("auth.leviathan.tyranids");
  });

  test.serial("📊 GET /idp/internet - 1/3 Hive Fleet operational", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s http://producer/idp/internet",
    );
    const lines = result.output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line: string) => JSON.parse(line));
    const failures = lines.filter(
      (e: { status: number }) => e.status === 0 || e.status >= 400,
    );
    expect(failures.length).toBe(2);
  });

  test.serial("🦑 Stop Kraken Hive Fleet", async () => {
    await env.stopService("auth.kraken.tyranids");
  });

  test.serial(
    "📊 GET /idp/internet - 0/3 Hive Fleets operational",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s http://producer/idp/internet",
      );
      const lines = result.output
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line: string) => JSON.parse(line));
      const failures = lines.filter(
        (e: { status: number }) => e.status === 0 || e.status >= 400,
      );
      expect(failures.length).toBe(3);
    },
  );

  test.serial(
    "❌ GET /idp/unknown - Unknown Hive Fleet returns 404",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer/idp/unknown",
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
