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

describe("GET /idp/internet - Aggregation logic", () => {
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("should return 200 when all IDP URLs are successful", async () => {
    const mockUrls = ["https://idp1.test", "https://idp2.test"];

    fetchSpy.mockResolvedValue({
      status: 200,
    });

    const req = new Request("http://localhost/idp/internet", {
      headers: { "Content-Type": "application/json" },
    });

    const res = await router.fetch(req, {
      HTTP_TIMEOUT: 0,
      IDP_URLS: mockUrls,
    });

    await expect(res.json()).resolves.toMatchInlineSnapshot(`
      {
        "successfuls": [
          {
            "status": 200,
            "url": "https://idp1.test",
          },
          {
            "status": 200,
            "url": "https://idp2.test",
          },
        ],
        "unsucessfuls": [],
      }
    `);
    expect(res.status).toBe(200);
  });

  it("should return 503 when more URLs fail than succeed", async () => {
    const mockUrls = [
      "https://idp1.test",
      "https://idp2.test",
      "https://idp3.test",
    ];

    fetchSpy
      .mockResolvedValueOnce({ status: 200 })
      .mockResolvedValueOnce({ status: 500 })
      .mockResolvedValueOnce({ status: 404 });

    const req = new Request("http://localhost/idp/internet");

    const res = await router.fetch(req, {
      HTTP_TIMEOUT: 0,
      IDP_URLS: mockUrls,
    });

    await expect(res.json()).resolves.toMatchInlineSnapshot(`
      {
        "successfuls": [
          {
            "status": 200,
            "url": "https://idp1.test",
          },
        ],
        "unsucessfuls": [
          {
            "status": 500,
            "url": "https://idp2.test",
          },
          {
            "status": 404,
            "url": "https://idp3.test",
          },
        ],
      }
    `);
    expect(res.status).toBe(503);
  });

  it("should return 503 when all URLs fail", async () => {
    const mockUrls = ["https://idp1.test", "https://idp2.test"];

    fetchSpy.mockResolvedValue({
      status: 500,
    });

    const req = new Request("http://localhost/idp/internet");

    const res = await router.fetch(req, {
      HTTP_TIMEOUT: 0,
      IDP_URLS: mockUrls,
    });

    await expect(res.json()).resolves.toMatchInlineSnapshot(`
      {
        "successfuls": [],
        "unsucessfuls": [
          {
            "status": 500,
            "url": "https://idp1.test",
          },
          {
            "status": 500,
            "url": "https://idp2.test",
          },
        ],
      }
    `);
    expect(res.status).toBe(503);
  });

  it("should return 503 when equal numbers succeed and fail", async () => {
    const mockUrls = ["https://idp1.test", "https://idp2.test"];

    fetchSpy
      .mockResolvedValueOnce({ status: 200 })
      .mockResolvedValueOnce({ status: 500 });

    const req = new Request("http://localhost/idp/internet");

    const res = await router.fetch(req, {
      HTTP_TIMEOUT: 0,
      IDP_URLS: mockUrls,
    });

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchInlineSnapshot(`
      {
        "successfuls": [
          {
            "status": 200,
            "url": "https://idp1.test",
          },
        ],
        "unsucessfuls": [
          {
            "status": 500,
            "url": "https://idp2.test",
          },
        ],
      }
    `);
  });

  it("should return 503 for empty IDP_URLS array", async () => {
    const req = new Request("http://localhost/idp/internet");

    const res = await router.fetch(req, {
      IDP_URLS: [],
    });

    await expect(res.json()).resolves.toMatchInlineSnapshot(`
      {
        "successfuls": [],
        "unsucessfuls": [],
      }
    `);
    expect(res.status).toBe(503);
  });

  it("should return status 0 with error when fetch throws", async () => {
    const mockUrls = ["https://idp1.test"];

    fetchSpy.mockRejectedValue(new Error("Network failure"));

    const req = new Request("http://localhost/idp/internet");

    const res = await router.fetch(req, {
      HTTP_TIMEOUT: 0,
      IDP_URLS: mockUrls,
    });

    await expect(res.json()).resolves.toMatchInlineSnapshot(`
      {
        "successfuls": [],
        "unsucessfuls": [
          {
            "error": "Network failure",
            "status": 0,
            "url": "https://idp1.test",
          },
        ],
      }
    `);
    expect(res.status).toBe(503);
  });

  it("should handle mix of successful responses and fetch errors", async () => {
    const mockUrls = ["https://idp1.test", "https://idp2.test"];

    fetchSpy
      .mockResolvedValueOnce({ status: 200 })
      .mockRejectedValueOnce(new Error("Connection refused"));

    const req = new Request("http://localhost/idp/internet");

    const res = await router.fetch(req, {
      HTTP_TIMEOUT: 0,
      IDP_URLS: mockUrls,
    });

    await expect(res.json()).resolves.toMatchInlineSnapshot(`
      {
        "successfuls": [
          {
            "status": 200,
            "url": "https://idp1.test",
          },
        ],
        "unsucessfuls": [
          {
            "error": "Connection refused",
            "status": 0,
            "url": "https://idp2.test",
          },
        ],
      }
    `);
    expect(res.status).toBe(503);
  });

  it("should correctly categorize different HTTP status codes", async () => {
    const mockUrls = [
      "https://idp1.test",
      "https://idp2.test",
      "https://idp3.test",
      "https://idp4.test",
    ];

    fetchSpy
      .mockResolvedValueOnce({ status: 200 })
      .mockResolvedValueOnce({ status: 301 })
      .mockResolvedValueOnce({ status: 404 })
      .mockResolvedValueOnce({ status: 100 });

    const req = new Request("http://localhost/idp/internet");

    const res = await router.fetch(req, {
      HTTP_TIMEOUT: 0,
      IDP_URLS: mockUrls,
    });

    await expect(res.json()).resolves.toMatchInlineSnapshot(`
      {
        "successfuls": [
          {
            "status": 200,
            "url": "https://idp1.test",
          },
          {
            "status": 301,
            "url": "https://idp2.test",
          },
        ],
        "unsucessfuls": [
          {
            "status": 404,
            "url": "https://idp3.test",
          },
          {
            "status": 100,
            "url": "https://idp4.test",
          },
        ],
      }
    `);
    expect(res.status).toBe(503);
  });
});
