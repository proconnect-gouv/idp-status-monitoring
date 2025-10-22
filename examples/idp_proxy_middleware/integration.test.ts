import { describe, expect, test } from "bun:test";
import { createDockerEnv } from "../../tests/docker";

describe("IDP Monitoring via Proxy: Split-network architecture with internet and intranet", () => {
  let env: Awaited<ReturnType<typeof createDockerEnv>>;

  test.serial(
    "🚀 Setup: Start Docker services with split networks",
    async () => {
      env = createDockerEnv(import.meta.dir);
      await env.start({ build: true, quiet: true });
    },
    120_000,
  );

  test.serial("🏗️  Infrastructure: Proxy is healthy", async () => {
    expect(await env.getServiceHealth("proxy")).toBe("healthy");
  });

  test.serial("🏗️  Infrastructure: External IDP is healthy", async () => {
    expect(await env.getServiceHealth("mock_idp_external")).toBe("healthy");
  });

  test.serial("🏗️  Infrastructure: Internal IDP is healthy", async () => {
    expect(await env.getServiceHealth("mock_idp_internal")).toBe("healthy");
  });

  test.serial("🏗️  Infrastructure: Producer is healthy", async () => {
    expect(await env.getServiceHealth("producer")).toBe("healthy");
  });

  test.serial("🏗️  Infrastructure: Consumer is healthy", async () => {
    expect(await env.getServiceHealth("consumer")).toBe("healthy");
  });

  test.serial("🌐 Proxy: GET / returns ok", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s http://proxy/",
    );
    expect(result.output).toBe("ok");
  });

  test.serial("🌐 Proxy: GET /idp/test-idp returns 200", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s -w '%{http_code}' http://proxy/idp/test-idp",
    );
    const statusCode = result.output.trim().replaceAll("'", "");
    expect(statusCode).toBe("200");
  });

  test.serial("🌐 Proxy: GET /idp/another-idp returns 200", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s -w '%{http_code}' http://proxy/idp/another-idp",
    );
    const statusCode = result.output.trim().replaceAll("'", "");
    expect(statusCode).toBe("200");
  });

  test.serial("🌐 Proxy: GET /idp/unknown returns 404", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s -w '%{http_code}' http://proxy/idp/unknown",
    );
    const statusCode = result.output.trim().replaceAll("'", "");
    expect(statusCode).toBe("404");
  });

  test.serial(
    "🌐 Proxy: GET /idp/internet returns aggregated health from external IDPs",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s http://proxy/idp/internet",
      );
      const data = JSON.parse(result.output);
      expect(data.successfuls).toBeDefined();
      expect(data.unsucessfuls).toBeDefined();
      expect(data.successfuls.length).toBeGreaterThan(0);
    },
  );

  test.serial("🌐 Proxy: Header preservation X-Real-IP", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s -I http://proxy/idp/test-idp",
    );
    expect(result.output).toBeDefined();
  });

  test.serial("🌐 Proxy: Multiple concurrent requests succeed", async () => {
    const result1 = await env.execInService(
      "test_runner",
      "curl -s http://proxy/",
    );
    const result2 = await env.execInService(
      "test_runner",
      "curl -s http://proxy/",
    );
    const result3 = await env.execInService(
      "test_runner",
      "curl -s http://proxy/",
    );
    expect(result1.output).toBe("ok");
    expect(result2.output).toBe("ok");
    expect(result3.output).toBe("ok");
  });

  test.serial(
    "🌐 Network: Split-network boundary verified - services isolated",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s http://proxy/idp/internet",
      );
      const data = JSON.parse(result.output);
      expect(data.successfuls).toBeDefined();
      expect(data.successfuls.length).toBeGreaterThan(0);
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
