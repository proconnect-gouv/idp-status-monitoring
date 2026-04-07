import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { createRoutes } from "./routes";

describe("GET /health routes", () => {
  it("GET /health/live returns 200 with alive status", async () => {
    using server = createTestServer();
    const res = await fetch(`${server.url}/health/live`);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchInlineSnapshot(`
      {
        "status": "alive",
      }
    `);
  });

  it("GET /health/startup returns 200 with started status", async () => {
    using server = createTestServer();
    const res = await fetch(`${server.url}/health/startup`);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchInlineSnapshot(`
      {
        "status": "started",
      }
    `);
  });

  it("GET /health returns 200 with health info", async () => {
    using server = createTestServer();
    const res = await fetch(`${server.url}/health`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      uptime: number;
      timestamp: string;
    };
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
    expect(typeof body.timestamp).toBe("string");
  });

  it("GET /health/ready returns 200 when connected", async () => {
    using server = createTestServer();
    const res = await fetch(`${server.url}/health/ready`);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchInlineSnapshot(`
      {
        "amqp": "connected",
        "status": "ready",
      }
    `);
  });

  it("GET /health/ready returns 503 when disconnected", async () => {
    using server = createTestServer({ isConnected: false });
    const res = await fetch(`${server.url}/health/ready`);

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchInlineSnapshot(`
      {
        "amqp": "disconnected",
        "status": "not ready",
      }
    `);
  });

  it("GET /unknown returns 404", async () => {
    using server = createTestServer();
    const res = await fetch(`${server.url}/unknown`);

    expect(res.status).toBe(404);
  });
});

describe("GET /health/idps", () => {
  let fetchSpy: ReturnType<typeof spyOn>;
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    fetchSpy = spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("returns 200 with empty lists when no IDPs configured", async () => {
    using server = createTestServer();
    const res = await originalFetch(`${server.url}/health/idps`);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchInlineSnapshot(`
      {
        "successfuls": [],
        "unsucessfuls": [],
      }
    `);
  });

  it("returns 200 always, even when all IDPs are down", async () => {
    fetchSpy.mockRejectedValue(new Error("Network error"));

    using server = createTestServer({
      config: {
        MAP_FI_NAMES_TO_URL: { "idp-a": "https://idp-a.example.com" },
        HTTP_TIMEOUT: 5000,
        HTTP_ACCEPT: "*/*",
        HTTP_USER_AGENT: "test-agent",
      },
    });
    const res = await originalFetch(`${server.url}/health/idps`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      successfuls: unknown[];
      unsucessfuls: unknown[];
    };
    expect(body.successfuls).toHaveLength(0);
    expect(body.unsucessfuls).toHaveLength(1);
  });

  it("puts reachable IDPs in successfuls and failed ones in unsucessfuls", async () => {
    fetchSpy
      .mockResolvedValueOnce({ status: 200 } as Response)
      .mockRejectedValueOnce(new Error("timeout"));

    using server = createTestServer({
      config: {
        MAP_FI_NAMES_TO_URL: {
          "idp-ok": "https://idp-ok.example.com",
          "idp-down": "https://idp-down.example.com",
        },
        HTTP_TIMEOUT: 5000,
        HTTP_ACCEPT: "*/*",
        HTTP_USER_AGENT: "test-agent",
      },
    });
    const res = await originalFetch(`${server.url}/health/idps`);

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      successfuls: Array<{ name: string; url: string; status: number }>;
      unsucessfuls: Array<{
        name: string;
        url: string;
        status: number;
        error: string;
      }>;
    };
    expect(body.successfuls).toHaveLength(1);
    expect(body.successfuls[0]).toMatchObject({
      name: "idp-ok",
      url: "https://idp-ok.example.com",
      status: 200,
    });
    expect(body.unsucessfuls).toHaveLength(1);
    expect(body.unsucessfuls[0]).toMatchObject({
      name: "idp-down",
      url: "https://idp-down.example.com",
      status: 0,
      error: "timeout",
    });
  });
});

//

function createTestServer({
  isConnected = true,
  config = {
    MAP_FI_NAMES_TO_URL: {},
    HTTP_TIMEOUT: 5000,
    HTTP_ACCEPT: "*/*",
    HTTP_USER_AGENT: "test-agent",
  },
}: {
  isConnected?: boolean;
  config?: {
    MAP_FI_NAMES_TO_URL: Record<string, string>;
    HTTP_TIMEOUT: number;
    HTTP_ACCEPT: string;
    HTTP_USER_AGENT: string;
  };
} = {}) {
  return Bun.serve({
    port: 0,
    routes: createRoutes(() => isConnected, config),
    fetch() {
      return new Response("Not Found", { status: 404 });
    },
  });
}
