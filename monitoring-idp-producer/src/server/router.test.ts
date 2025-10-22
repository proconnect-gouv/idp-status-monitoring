import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import { Hono } from "hono";
import type { ServerContext } from "./context";
import { router } from "./router";

describe("Server endpoints", () => {
  describe("GET /", () => {
    it("should return 200 with 'ok' response", async () => {
      const req = new Request("http://localhost/");
      const res = await router.fetch(req);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("ok");
    });
  });

  describe("GET /idp/internet", () => {
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

    it("should correctly categorize different HTTP status codes", async () => {
      const mockUrls = [
        "https://idp1.test", // 200 - success
        "https://idp2.test", // 301 - redirect (success)
        "https://idp3.test", // 404 - not found (failure)
        "https://idp4.test", // 100 - continue (failure)
      ];

      fetchSpy
        .mockResolvedValueOnce({ status: 200 })
        .mockResolvedValueOnce({ status: 301 })
        .mockResolvedValueOnce({ status: 404 })
        .mockResolvedValueOnce({ status: 100 });

      const req = new Request("http://localhost/idp/internet");

      const res = await router.fetch(req, {
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

  describe("GET /idp/:name", () => {
    let mockChannelWrapper: any;
    let test_app: Hono<ServerContext>;

    beforeEach(() => {
      mockChannelWrapper = {
        once: mock((_correlationId, callback) => {
          // Immediately call the callback to simulate RPC response
          callback(JSON.stringify({ status: 200 }));
        }),
        sendToQueue: mock(() => {}),
      };

      test_app = new Hono<ServerContext>()
        .use(({ set }, next) => {
          set("channelWrapper", mockChannelWrapper);
          return next();
        })
        .route("", router);
    });

    it("should call channelWrapper methods for valid requests", async () => {
      const req = new Request("http://localhost/idp/test-idp");

      const res = await test_app.fetch(req, {
        HTTP_TIMEOUT: 0,
      });

      // Verify that the RPC methods were called
      expect(mockChannelWrapper.once).toHaveBeenCalled();
      expect(mockChannelWrapper.sendToQueue).toHaveBeenCalled();

      // With immediate callback, should get the mocked status
      expect(res.status).toBe(200);
    });

    it("should return 404 when RPC responds with 404", async () => {
      // Override the mock for this test
      mockChannelWrapper.once = mock((_correlationId, callback) => {
        callback(JSON.stringify({ status: 404 }));
      });

      const req = new Request("http://localhost/idp/test-idp");
      const res = await test_app.fetch(req, {
        HTTP_TIMEOUT: 0,
      });

      expect(res.status).toBe(404);
    });

    it("should return 500 for invalid RPC response", async () => {
      // Override the mock to return invalid JSON
      mockChannelWrapper.once = mock((_correlationId, callback) => {
        callback(JSON.stringify({})); // No status field
      });

      const req = new Request("http://localhost/idp/test-idp");
      const res = await test_app.fetch(req, {
        HTTP_TIMEOUT: 0,
      });

      expect(res.status).toBe(500); // Default when no status in response
    });

    it("should return 503 on timeout", async () => {
      // Override the mock to not call callback (simulate timeout)
      mockChannelWrapper.once = mock(() => {
        // Don't call callback, let timeout trigger
      });

      const req = new Request("http://localhost/idp/test-idp");
      const res = await test_app.fetch(req, {
        HTTP_TIMEOUT: 1, // Very short timeout
      });

      // Wait a bit to ensure timeout fires
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(res.status).toBe(503);
    });

    it("should handle malformed JSON in RPC response", async () => {
      mockChannelWrapper.once = mock((_correlationId, callback) => {
        callback("invalid json"); // Invalid JSON
      });

      const req = new Request("http://localhost/idp/test-idp");
      const res = await test_app.fetch(req, {
        HTTP_TIMEOUT: 100,
      });

      expect(res.status).toBe(500); // Should handle JSON parsing error
    });
  });
});
