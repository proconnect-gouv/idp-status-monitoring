import { describe, expect, test } from "bun:test";
import { createDockerEnv } from "../../tests/docker";

describe("IDP Monitoring via Proxy: Request forwarding and header preservation", () => {
  let env: Awaited<ReturnType<typeof createDockerEnv>>;

  test.serial(
    "🚀 Setup: Start Docker services with nginx proxy",
    async () => {
      env = createDockerEnv(import.meta.dir);
      await env.start({ build: true, quiet: true });
    },
    120_000,
  );

  test.serial("🏗️  Infrastructure: Proxy is healthy", async () => {
    expect(await env.getServiceHealth("proxy")).toBe("healthy");
  });

  test.serial("🌐 GET / through proxy returns ok", async () => {
    const result = await env.execInService(
      "test-runner",
      "curl -s http://proxy/",
    );
    expect(result.output).toBe("ok");
  });

  test.serial("🌐 GET /idp/test-idp through proxy returns 200", async () => {
    const result = await env.execInService(
      "test-runner",
      "curl -s -w '%{http_code}' http://proxy/idp/test-idp",
    );
    const statusCode = result.output.trim().replaceAll("'", "");
    expect(statusCode).toBe("200");
  });

  test.serial("🌐 GET /idp/another-idp through proxy returns 200", async () => {
    const result = await env.execInService(
      "test-runner",
      "curl -s -w '%{http_code}' http://proxy/idp/another-idp",
    );
    const statusCode = result.output.trim().replaceAll("'", "");
    expect(statusCode).toBe("200");
  });

  test.serial("🌐 GET /idp/unknown through proxy returns 404", async () => {
    const result = await env.execInService(
      "test-runner",
      "curl -s -w '%{http_code}' http://proxy/idp/unknown",
    );
    const statusCode = result.output.trim().replaceAll("'", "");
    expect(statusCode).toBe("404");
  });

  test.serial(
    "🌐 GET /idp/internet through proxy returns aggregated health",
    async () => {
      const result = await env.execInService(
        "test-runner",
        "curl -s http://proxy/idp/internet",
      );
      const data = JSON.parse(result.output);
      expect(data.successfuls).toBeDefined();
      expect(data.unsucessfuls).toBeDefined();
      expect(data.successfuls.length).toBeGreaterThan(0);
    },
  );

  test.serial("🌐 Proxy forwards multiple requests correctly", async () => {
    const result1 = await env.execInService(
      "test-runner",
      "curl -s http://proxy/",
    );
    const result2 = await env.execInService(
      "test-runner",
      "curl -s http://proxy/",
    );
    const result3 = await env.execInService(
      "test-runner",
      "curl -s http://proxy/",
    );
    expect(result1.output).toBe("ok");
    expect(result2.output).toBe("ok");
    expect(result3.output).toBe("ok");
  });

  test.serial(
    "🧹 Cleanup: Stop all services",
    async () => {
      await env[Symbol.asyncDispose]();
    },
    30_000,
  );
});
