import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { Hono } from "hono";
import type { ServerContext } from "./context";
import { router } from "./router";

const makeApp = (connection: { isConnected: () => boolean } | null = null) =>
  new Hono<ServerContext>()
    .use((c, next) => {
      c.set("connection", connection as any);
      return next();
    })
    .route("", router);

describe("GET /livez", () => {
  it("should return 200 with alive status", async () => {
    const res = await router.fetch(new Request("http://localhost/livez"), {});
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchInlineSnapshot(`
      {
        "status": "alive",
      }
    `);
  });
});

describe("GET /healthz", () => {
  it("should return 200 with uptime and timestamp", async () => {
    const res = await router.fetch(new Request("http://localhost/healthz"), {});
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
});

describe("GET /readyz", () => {
  it("should return 200 when AMQP is connected", async () => {
    const app = makeApp({ isConnected: () => true });
    const res = await app.fetch(new Request("http://localhost/readyz"), {});
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchInlineSnapshot(`
      {
        "amqp": "connected",
        "status": "ready",
      }
    `);
  });

  it("should return 503 when AMQP is disconnected", async () => {
    const app = makeApp({ isConnected: () => false });
    const res = await app.fetch(new Request("http://localhost/readyz"), {});
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchInlineSnapshot(`
      {
        "amqp": "disconnected",
        "status": "not ready",
      }
    `);
  });

  it("should return 503 when connection is null", async () => {
    const app = makeApp(null);
    const res = await app.fetch(new Request("http://localhost/readyz"), {});
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchInlineSnapshot(`
      {
        "amqp": "disconnected",
        "status": "not ready",
      }
    `);
  });
});

const parseNDJSON = async (res: Response) => {
  const text = await res.text();
  return text
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .sort((a, b) => a.url.localeCompare(b.url));
};

describe("GET /idp/internet - NDJSON streaming", () => {
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("should stream one line per URL", async () => {
    fetchSpy.mockResolvedValue({ status: 200 });

    const res = await router.fetch(
      new Request("http://localhost/idp/internet"),
      {
        HTTP_TIMEOUT: 0,
        IDP_URLS: ["https://idp1.test", "https://idp2.test"],
      },
    );

    expect(res.status).toBe(200);
    await expect(parseNDJSON(res)).resolves.toMatchInlineSnapshot(`
      [
        {
          "status": 200,
          "url": "https://idp1.test",
        },
        {
          "status": 200,
          "url": "https://idp2.test",
        },
      ]
    `);
  });

  it("should stream status 0 with error when fetch throws", async () => {
    fetchSpy.mockRejectedValue(new Error("Network failure"));

    const res = await router.fetch(
      new Request("http://localhost/idp/internet"),
      {
        HTTP_TIMEOUT: 0,
        IDP_URLS: ["https://idp1.test"],
      },
    );

    expect(res.status).toBe(200);
    await expect(parseNDJSON(res)).resolves.toMatchInlineSnapshot(`
      [
        {
          "error": "Network failure",
          "status": 0,
          "url": "https://idp1.test",
        },
      ]
    `);
  });

  it("should stream mix of successes and errors", async () => {
    fetchSpy
      .mockResolvedValueOnce({ status: 200 })
      .mockRejectedValueOnce(new Error("Connection refused"));

    const res = await router.fetch(
      new Request("http://localhost/idp/internet"),
      {
        HTTP_TIMEOUT: 0,
        IDP_URLS: ["https://idp1.test", "https://idp2.test"],
      },
    );

    expect(res.status).toBe(200);
    await expect(parseNDJSON(res)).resolves.toMatchInlineSnapshot(`
      [
        {
          "status": 200,
          "url": "https://idp1.test",
        },
        {
          "error": "Connection refused",
          "status": 0,
          "url": "https://idp2.test",
        },
      ]
    `);
  });

  it("should return empty body for empty IDP_URLS", async () => {
    const res = await router.fetch(
      new Request("http://localhost/idp/internet"),
      {
        IDP_URLS: [],
      },
    );

    expect(res.status).toBe(200);
    await expect(parseNDJSON(res)).resolves.toMatchInlineSnapshot(`[]`);
  });
});
