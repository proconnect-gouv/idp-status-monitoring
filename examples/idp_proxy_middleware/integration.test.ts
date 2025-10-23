import { createDockerEnv } from "#testing/docker";
import { describe, expect, test } from "bun:test";

describe("IDP Monitoring via Proxy: Split-network architecture with internet and intranet", () => {
  const env = createDockerEnv(import.meta.dir);

  test.serial(
    "🚀 Setup: Start Docker services with split networks",
    async () => {
      await env.start({ build: true, quiet: true });
    },
    120_000,
  );

  test.serial("🌐 Producer: GET / returns ok", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s http://producer/",
    );
    expect(result.output).toBe("ok");
  });

  test.serial(
    "🔨 Producer: GET /idp/olympia - Iron Warriors Olympia IdP returns 200",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer/idp/olympia",
      );
      expect(result.output).toBe("'200'");
    },
  );

  test.serial(
    "⚔️ Producer: GET /idp/medrengard - Iron Warriors Medrengard IdP returns 200",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer/idp/medrengard",
      );
      expect(result.output).toBe("'200'");
    },
  );

  test.serial("🌐 Producer: GET /idp/unknown returns 404", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s -w '%{http_code}' http://producer/idp/unknown",
    );
    expect(result.output).toBe("'404'");
  });

  test.serial(
    "🌐 Producer: GET /idp/internet returns aggregated health from external IDPs",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s http://producer/idp/internet",
      );
      const data = JSON.parse(result.output);
      expect(data).toMatchInlineSnapshot(`
        {
          "successfuls": [
            {
              "status": 200,
              "url": "http://auth.olympia.ironwarriors",
            },
            {
              "status": 200,
              "url": "http://auth.medrengard.ironwarriors",
            },
          ],
          "unsucessfuls": [],
        }
      `);
    },
  );

  test.serial(
    "🏰 Producer: RPC call to Imperial Fists IdP through fortress walls works",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer/idp/olympia",
      );
      expect(result.output).toBe("'200'");
    },
  );

  test.serial(
    "🛡️ Producer: Multiple siege attempts withstand assault",
    async () => {
      const results = await Promise.allSettled([
        env.execInService("test_runner", "curl -s http://producer/"),
        env.execInService("test_runner", "curl -s http://producer/"),
        env.execInService("test_runner", "curl -s http://producer/"),
      ]);
      expect(results).toMatchInlineSnapshot(`
      [
        {
          "status": "fulfilled",
          "value": {
            "exitCode": 0,
            "output": "ok",
          },
        },
        {
          "status": "fulfilled",
          "value": {
            "exitCode": 0,
            "output": "ok",
          },
        },
        {
          "status": "fulfilled",
          "value": {
            "exitCode": 0,
            "output": "ok",
          },
        },
      ]
    `);
    },
  );

  test.serial(
    "🏰 Network: Fortress walls hold - consumer protects Imperial Fists IdPs from siege",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer/idp/medrengard",
      );
      expect(result.output).toBe("'200'");
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
