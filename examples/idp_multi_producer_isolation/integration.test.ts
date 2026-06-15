import { createDockerEnv } from "#testing/docker";
import { describe, expect, test } from "bun:test";

describe("IDP Multi-Producer Isolation: Direct Reply-to prevents reply stealing", () => {
  const env = createDockerEnv(import.meta.dir);

  test.serial(
    "🚀 Setup: Start Docker services with two producer instances",
    async () => {
      await env.start({ build: true, quiet: true });
    },
    120_000,
  );

  test.serial("📨 Consumer: Loaded Space Wolves configuration", async () => {
    const consumerLogs = await env.getServiceLogs("consumer");
    expect(consumerLogs).toContain("Consumer started successfully!");
    expect(consumerLogs).toContain("fenris");
    expect(consumerLogs).toContain("asaheim");
  });

  test.serial("🐺 Producer Alpha: Connected to RabbitMQ", async () => {
    const logs = await env.getServiceLogs("producer_alpha");
    expect(logs).toContain("Connected to RabbitMQ");
    expect(logs).toContain('Asserting queue "monitoring-producer"');
  });

  test.serial("🐺 Producer Bravo: Connected to RabbitMQ", async () => {
    const logs = await env.getServiceLogs("producer_bravo");
    expect(logs).toContain("Connected to RabbitMQ");
    expect(logs).toContain('Asserting queue "monitoring-producer"');
  });

  test.serial(
    "⚔️ GET /idp/fenris - Alpha RPC returns correct response",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -o /dev/null -w '%{http_code}' http://producer_alpha/idp/fenris",
      );
      expect(result.output).toBe("'200'");
    },
  );

  test.serial(
    "⚔️ GET /idp/asaheim - Bravo RPC returns correct response",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -o /dev/null -w '%{http_code}' http://producer_bravo/idp/asaheim",
      );
      expect(result.output).toBe("'200'");
    },
  );

  test.serial(
    "🔀 Concurrent RPC across both producers — no reply stealing (Direct Reply-to)",
    async () => {
      const requests = Array.from({ length: 10 }, (_, i) => {
        const producer = i % 2 === 0 ? "producer_alpha" : "producer_bravo";
        const idp = i % 2 === 0 ? "fenris" : "asaheim";
        return env.execInService(
          "test_runner",
          `curl -s -o /dev/null -w '%{http_code}' http://${producer}/idp/${idp}`,
        );
      });

      const results = await Promise.all(requests);

      for (const result of results) {
        expect(result.output).toBe("'200'");
      }
    },
    30_000,
  );

  test.serial(
    "❌ GET /idp/unknown - Both producers return 404 for unknown IDP",
    async () => {
      const [alpha, bravo] = await Promise.all([
        env.execInService(
          "test_runner",
          "curl -s -o /dev/null -w '%{http_code}' http://producer_alpha/idp/unknown",
        ),
        env.execInService(
          "test_runner",
          "curl -s -o /dev/null -w '%{http_code}' http://producer_bravo/idp/unknown",
        ),
      ]);
      expect(alpha.output).toBe("'404'");
      expect(bravo.output).toBe("'404'");
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
