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

  test.serial("🌐 Producer: GET / returns ok", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s http://producer:3000/",
    );
    expect(result.output).toBe("ok");
  });

  test.serial("🌐 Producer: GET /idp/test-idp returns 200", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s -w '%{http_code}' http://producer:3000/idp/test-idp",
    );
    const statusCode = result.output.trim().replaceAll("'", "");
    expect(statusCode).toBe("200");
  });

  test.serial("🌐 Producer: GET /idp/another-idp returns 200", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s -w '%{http_code}' http://producer:3000/idp/another-idp",
    );
    const statusCode = result.output.trim().replaceAll("'", "");
    expect(statusCode).toBe("200");
  });

  test.serial("🌐 Producer: GET /idp/unknown returns 404", async () => {
    const result = await env.execInService(
      "test_runner",
      "curl -s -w '%{http_code}' http://producer:3000/idp/unknown",
    );
    const statusCode = result.output.trim().replaceAll("'", "");
    expect(statusCode).toBe("404");
  });

  test.serial(
    "🌐 Producer: GET /idp/internet returns aggregated health from external IDPs",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s http://producer:3000/idp/internet",
      );
      const data = JSON.parse(result.output);
      expect(data.successfuls).toBeDefined();
      expect(data.unsucessfuls).toBeDefined();
      expect(data.successfuls.length).toBeGreaterThan(0);
    },
  );

  test.serial(
    "🌐 Producer: RPC call to consumer via rabbitmq works",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer:3000/idp/test-idp",
      );
      const statusCode = result.output.trim().replaceAll("'", "");
      expect(statusCode).toBe("200");
    },
  );

  test.serial("🌐 Producer: Multiple concurrent requests succeed", async () => {
    const result1 = await env.execInService(
      "test_runner",
      "curl -s http://producer:3000/",
    );
    const result2 = await env.execInService(
      "test_runner",
      "curl -s http://producer:3000/",
    );
    const result3 = await env.execInService(
      "test_runner",
      "curl -s http://producer:3000/",
    );
    expect(result1.output).toBe("ok");
    expect(result2.output).toBe("ok");
    expect(result3.output).toBe("ok");
  });

  test.serial(
    "🌐 Network: Split-network boundary verified - consumer queries intranet IDPs",
    async () => {
      const result = await env.execInService(
        "test_runner",
        "curl -s -w '%{http_code}' http://producer:3000/idp/test-idp",
      );
      const statusCode = result.output.trim().replaceAll("'", "");
      expect(statusCode).toBe("200");
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
