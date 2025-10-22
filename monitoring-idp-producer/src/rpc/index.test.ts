//

import type { Config } from "#src/config";
import { InMemoryChannel, InMemoryConnection } from "@/mocks/amqp/in-memory";
import { describe, expect, it, spyOn } from "bun:test";
import { setupRpcProducer } from "./index";

// Mock the config schema to avoid environment dependencies
const mockConfig: Config = {
  AMQP_URL: "amqp://localhost:5672",
  QUEUE_CONSUMER_NAME: "test-consumer-queue",
  QUEUE_PRODUCER_NAME: "test-producer-queue",
  IDP_URLS: [],
  HTTP_TIMEOUT: 5000,
  PORT: 3000,
};
const connection = new InMemoryConnection();

describe("RPC Producer Channel", () => {
  describe("setupRpcProducer", () => {
    it("should consume messages and emit correlation events", async () => {
      const channel = setupRpcProducer(connection as any, mockConfig) as any;

      // Create promise to wait for correlation event
      const correlationPromise = new Promise<string>((resolve) => {
        channel.once("test-correlation-123", resolve);
      });

      // Send message to the consumer
      channel.emit("deliver-message", "test-consumer-queue", "test response", {
        correlationId: "test-correlation-123",
      });

      const response = await correlationPromise;
      expect(response).toBe("test response");
    });

    it("should handle multiple correlation IDs", async () => {
      const channel = setupRpcProducer(connection as any, mockConfig) as any;

      const correlationPromises = [
        new Promise<string>((resolve) => {
          channel.once("corr-1", resolve);
        }),
        new Promise<string>((resolve) => {
          channel.once("corr-2", resolve);
        }),
        new Promise<string>((resolve) => {
          channel.once("corr-3", resolve);
        }),
      ];

      // Send multiple messages with different correlation IDs
      channel.emit("deliver-message", "test-consumer-queue", "response-1", {
        correlationId: "corr-1",
      });
      channel.emit("deliver-message", "test-consumer-queue", "response-2", {
        correlationId: "corr-2",
      });
      channel.emit("deliver-message", "test-consumer-queue", "response-3", {
        correlationId: "corr-3",
      });

      const responses = await Promise.all(correlationPromises);
      expect(responses).toEqual(["response-1", "response-2", "response-3"]);
    });

    it("should handle JSON response messages", async () => {
      const channel = setupRpcProducer(connection as any, mockConfig) as any;

      const correlationPromise = new Promise<string>((resolve) => {
        channel.once("json-test", resolve);
      });

      const jsonResponse = JSON.stringify({ status: 200, message: "OK" });
      channel.emit("deliver-message", "test-consumer-queue", jsonResponse, {
        correlationId: "json-test",
      });

      const response = await correlationPromise;
      expect(response).toBe(jsonResponse);
      expect(JSON.parse(response)).toEqual({ status: 200, message: "OK" });
    });

    it("should set max listeners to 0", () => {
      const setMaxListenersSpy = spyOn(
        InMemoryChannel.prototype,
        "setMaxListeners",
      );

      setupRpcProducer(connection as any, mockConfig);

      expect(setMaxListenersSpy).toHaveBeenCalledWith(0);

      setMaxListenersSpy.mockRestore();
    });

    it("should handle concurrent requests with responses arriving out of order", async () => {
      const channel = setupRpcProducer(connection as any, mockConfig) as any;

      // Create promises for concurrent requests
      const request1 = new Promise<string>((resolve) => {
        channel.once("req-1", resolve);
      });
      const request2 = new Promise<string>((resolve) => {
        channel.once("req-2", resolve);
      });
      const request3 = new Promise<string>((resolve) => {
        channel.once("req-3", resolve);
      });

      // Simulate responses arriving out of order (3, 1, 2)
      setTimeout(() => {
        channel.emit("deliver-message", "test-consumer-queue", "response-3", {
          correlationId: "req-3",
        });
      }, 10);

      setTimeout(() => {
        channel.emit("deliver-message", "test-consumer-queue", "response-1", {
          correlationId: "req-1",
        });
      }, 20);

      setTimeout(() => {
        channel.emit("deliver-message", "test-consumer-queue", "response-2", {
          correlationId: "req-2",
        });
      }, 30);

      // Each request should receive its correct response regardless of order
      const [response1, response2, response3] = await Promise.all([
        request1,
        request2,
        request3,
      ]);

      expect(response1).toBe("response-1");
      expect(response2).toBe("response-2");
      expect(response3).toBe("response-3");
    });

    it("should handle high concurrency with many simultaneous requests", async () => {
      const channel = setupRpcProducer(connection as any, mockConfig) as any;

      const numRequests = 50;
      const requests: Promise<string>[] = [];

      // Create 50 concurrent requests
      for (let i = 0; i < numRequests; i++) {
        const promise = new Promise<string>((resolve) => {
          channel.once(`high-load-${i}`, resolve);
        });
        requests.push(promise);
      }

      // Send all responses (simulating consumer processing them)
      for (let i = 0; i < numRequests; i++) {
        channel.emit("deliver-message", "test-consumer-queue", `response-${i}`, {
          correlationId: `high-load-${i}`,
        });
      }

      const responses = await Promise.all(requests);

      // Verify all responses match their requests
      for (let i = 0; i < numRequests; i++) {
        expect(responses[i]).toBe(`response-${i}`);
      }
    });
  });

  describe("setupRpcProducer - edge cases", () => {
    it("should nack malformed message with no content", async () => {
      const channel = setupRpcProducer(connection as any, mockConfig) as any;

      let nackCalled = false;
      const originalNack = channel.nack ? channel.nack.bind(channel) : () => {};
      channel.nack = (...args: any[]) => {
        nackCalled = true;
        return originalNack(...args);
      };

      // Emit message without content
      channel.consumers.get("test-consumer-queue")({
        content: null, // Malformed: no content
        properties: {
          correlationId: "test-123",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should have called nack
      expect(nackCalled).toBe(true);
    });

    it("should nack message with missing correlationId", async () => {
      const channel = setupRpcProducer(connection as any, mockConfig) as any;

      let nackCalled = false;
      const originalNack = channel.nack ? channel.nack.bind(channel) : () => {};
      channel.nack = (...args: any[]) => {
        nackCalled = true;
        return originalNack(...args);
      };

      // Emit message without correlationId
      channel.consumers.get("test-consumer-queue")({
        content: Buffer.from(JSON.stringify({ status: 200 })),
        properties: {
          // correlationId missing!
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should nack
      expect(nackCalled).toBe(true);
    });

    it("should nack message when emit throws error", async () => {
      const channel = setupRpcProducer(connection as any, mockConfig) as any;

      let nackCalled = false;
      const originalNack = channel.nack ? channel.nack.bind(channel) : () => {};
      const originalEmit = channel.emit ? channel.emit.bind(channel) : () => true;
      channel.nack = (...args: any[]) => {
        nackCalled = true;
        return originalNack(...args);
      };
      channel.emit = (event: string, ...args: any[]) => {
        if (event !== "deliver-message") {
          throw new Error("emit failed");
        }
        return originalEmit(event, ...args);
      };

      channel.consumers.get("test-consumer-queue")({
        content: Buffer.from(JSON.stringify({ status: 200 })),
        properties: {
          correlationId: "test-123",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should have called nack due to emit error
      expect(nackCalled).toBe(true);
    });

    it("should nack message with missing properties object", async () => {
      const channel = setupRpcProducer(connection as any, mockConfig) as any;

      let nackCalled = false;
      const originalNack = channel.nack ? channel.nack.bind(channel) : () => {};
      channel.nack = (...args: any[]) => {
        nackCalled = true;
        return originalNack(...args);
      };

      // Emit message without properties
      channel.consumers.get("test-consumer-queue")({
        content: Buffer.from(JSON.stringify({ status: 200 })),
        properties: null, // Malformed: no properties
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should have called nack
      expect(nackCalled).toBe(true);
    });
  });
});
