import { describe, expect, it } from "bun:test";
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

//

function createTestServer({
  isConnected = true,
}: { isConnected?: boolean } = {}) {
  return Bun.serve({
    port: 0,
    routes: createRoutes(() => isConnected),
    fetch() {
      return new Response("Not Found", { status: 404 });
    },
  });
}
