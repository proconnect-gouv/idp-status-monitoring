//

import type { Config } from "#src/config";
import { InMemoryConnection } from "@/mocks/amqp/in-memory";
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { setupMessageConsumer } from "./index";

const connection = new InMemoryConnection();
describe("RPC Message Consumer with EventEmitter", () => {
  let globalFetchSpy: any;

  const testConfig: Config = {
    AMQP_URL: "amqp://localhost:5672",
    QUEUE_PRODUCER_NAME: "test-queue",
    MAP_FI_NAMES_TO_URL: {
      "test-idp": "https://test-idp.example.com",
      "another-idp": "https://another-idp.example.com",
    },
    HTTP_TIMEOUT: 5000,
    HTTP_USER_AGENT: "test-agent/1.0",
    HTTP_ACCEPT: "application/json",
    IDP_URLS: [],
    QUEUE_CONSUMER_NAME: "test-consumer-queue",
  };

  beforeEach(() => {
    globalFetchSpy = spyOn(global, "fetch");
  });

  afterEach(() => {
    globalFetchSpy.mockRestore();
  });

  describe("setupMessageConsumer", () => {
    it("should setup channel and consumer", () => {
      const channel = setupMessageConsumer(connection as any, testConfig);
      expect(channel).toBeDefined();
    });

    it("should process message for known IDP", async () => {
      const channel = setupMessageConsumer(
        connection as any,
        testConfig,
      ) as any;
      globalFetchSpy.mockResolvedValue({ status: 200 });

      // Create promise to wait for message response
      const responsePromise = new Promise<any>((resolve) => {
        channel.once("message-sent", resolve);
      });

      // Trigger consumer with test message
      channel.emit("deliver-message", "test-queue", "test-idp", {
        correlationId: "test-123",
        replyTo: "reply-queue",
      });

      const response = await responsePromise;

      expect(response.queueName).toBe("reply-queue");
      expect(response.content).toBe(JSON.stringify({ status: 200 }));
      expect(response.options.correlationId).toBe("test-123");

      expect(globalFetchSpy).toHaveBeenCalledWith(
        "https://test-idp.example.com",
        {
          signal: expect.any(AbortSignal),
          headers: expect.any(Headers),
        },
      );
    });

    it("should return 404 for unknown IDP", async () => {
      const channel = setupMessageConsumer(
        connection as any,
        testConfig,
      ) as any;

      const responsePromise = new Promise<any>((resolve) => {
        channel.once("message-sent", resolve);
      });

      channel.emit("deliver-message", "test-queue", "unknown-idp", {
        correlationId: "test-123",
        replyTo: "reply-queue",
      });

      const response = await responsePromise;

      expect(response.content).toBe(JSON.stringify({ status: 404 }));
      expect(globalFetchSpy).not.toHaveBeenCalled();
    });

    it("should handle fetch errors", async () => {
      const channel = setupMessageConsumer(
        connection as any,
        testConfig,
      ) as any;

      const fetchError = new Error("Network error");
      globalFetchSpy.mockRejectedValue(fetchError);

      const responsePromise = new Promise<any>((resolve) => {
        channel.once("message-sent", resolve);
      });

      channel.emit("deliver-message", "test-queue", "test-idp", {
        correlationId: "test-123",
        replyTo: "reply-queue",
      });

      const response = await responsePromise;

      expect(response.content).toBe(JSON.stringify({ status: 500 }));
    });

    it("should handle different HTTP status codes", async () => {
      const channel = setupMessageConsumer(
        connection as any,
        testConfig,
      ) as any;

      const testCases = [
        { status: 200, idp: "test-idp" },
        { status: 404, idp: "test-idp" },
        { status: 500, idp: "test-idp" },
        { status: 301, idp: "another-idp" },
      ];

      for (const testCase of testCases) {
        globalFetchSpy.mockResolvedValueOnce({ status: testCase.status });

        const responsePromise = new Promise<any>((resolve) => {
          channel.once("message-sent", resolve);
        });

        channel.emit("deliver-message", "test-queue", testCase.idp, {
          correlationId: `test-${testCase.status}`,
          replyTo: "reply-queue",
        });

        const response = await responsePromise;
        expect(response.content).toBe(
          JSON.stringify({ status: testCase.status }),
        );
      }
    });

    it("should handle HTTP timeout with AbortSignal", async () => {
      const shortTimeoutConfig: Config = {
        ...testConfig,
        HTTP_TIMEOUT: 50, // 50ms timeout
      };

      const channel = setupMessageConsumer(
        connection as any,
        shortTimeoutConfig,
      ) as any;

      // Mock fetch to reject with timeout error
      globalFetchSpy.mockRejectedValue(
        new Error("The operation was aborted"),
      );

      const responsePromise = new Promise<any>((resolve) => {
        channel.once("message-sent", resolve);
      });

      channel.emit("deliver-message", "test-queue", "test-idp", {
        correlationId: "timeout-test",
        replyTo: "reply-queue",
      });

      const response = await responsePromise;

      // Should return 500 because the request was aborted
      expect(response.content).toBe(JSON.stringify({ status: 500 }));
    });

    it("should handle multiple concurrent messages correctly", async () => {
      const channel = setupMessageConsumer(
        connection as any,
        testConfig,
      ) as any;

      // Track all sent messages
      const sentMessages: any[] = [];
      channel.on("message-sent", (msg: any) => {
        sentMessages.push(msg);
      });

      // Mock different responses for different requests
      globalFetchSpy
        .mockResolvedValueOnce({ status: 200 })
        .mockResolvedValueOnce({ status: 404 })
        .mockResolvedValueOnce({ status: 500 });

      // Send all three messages
      channel.emit("deliver-message", "test-queue", "test-idp", {
        correlationId: "concurrent-1",
        replyTo: "reply-queue-1",
      });
      channel.emit("deliver-message", "test-queue", "test-idp", {
        correlationId: "concurrent-2",
        replyTo: "reply-queue-2",
      });
      channel.emit("deliver-message", "test-queue", "test-idp", {
        correlationId: "concurrent-3",
        replyTo: "reply-queue-3",
      });

      // Wait for all messages to be processed
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify all 3 responses were sent
      expect(sentMessages.length).toBe(3);

      // Find each response by correlation ID and verify
      const response1 = sentMessages.find(
        (m) => m.options.correlationId === "concurrent-1",
      );
      const response2 = sentMessages.find(
        (m) => m.options.correlationId === "concurrent-2",
      );
      const response3 = sentMessages.find(
        (m) => m.options.correlationId === "concurrent-3",
      );

      expect(response1.content).toBe(JSON.stringify({ status: 200 }));
      expect(response2.content).toBe(JSON.stringify({ status: 404 }));
      expect(response3.content).toBe(JSON.stringify({ status: 500 }));
    });
  });

  describe("setupMessageConsumer - edge cases", () => {
    it("should nack malformed message with no content", async () => {
      const channel = setupMessageConsumer(
        connection as any,
        testConfig,
      ) as any;

      let nackCalled = false;
      const originalNack = channel.nack ? channel.nack.bind(channel) : () => {};
      channel.nack = (...args: any[]) => {
        nackCalled = true;
        return originalNack(...args);
      };

      // Call consumer directly with malformed message (no content)
      channel.consumers.get("test-queue")({
        content: null, // Malformed: no content
        properties: {
          correlationId: "test-123",
          replyTo: "reply-queue",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should have called nack
      expect(nackCalled).toBe(true);
    });

    it("should nack message with missing correlationId", async () => {
      const channel = setupMessageConsumer(
        connection as any,
        testConfig,
      ) as any;

      let nackCalled = false;
      let sendToQueueCalled = false;
      const originalNack = channel.nack ? channel.nack.bind(channel) : () => {};
      const originalSendToQueue = channel.sendToQueue ? channel.sendToQueue.bind(channel) : () => {};
      channel.nack = (...args: any[]) => {
        nackCalled = true;
        return originalNack(...args);
      };
      channel.sendToQueue = (...args: any[]) => {
        sendToQueueCalled = true;
        return originalSendToQueue(...args);
      };

      // Emit message without correlationId
      channel.consumers.get("test-queue")({
        content: Buffer.from("test-idp"),
        properties: {
          // correlationId missing!
          replyTo: "reply-queue",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should nack and not send reply
      expect(nackCalled).toBe(true);
      expect(sendToQueueCalled).toBe(false);
    });

    it("should nack message with missing replyTo", async () => {
      const channel = setupMessageConsumer(
        connection as any,
        testConfig,
      ) as any;

      let nackCalled = false;
      let sendToQueueCalled = false;
      const originalNack = channel.nack ? channel.nack.bind(channel) : () => {};
      const originalSendToQueue = channel.sendToQueue ? channel.sendToQueue.bind(channel) : () => {};
      channel.nack = (...args: any[]) => {
        nackCalled = true;
        return originalNack(...args);
      };
      channel.sendToQueue = (...args: any[]) => {
        sendToQueueCalled = true;
        return originalSendToQueue(...args);
      };

      // Emit message without replyTo
      channel.consumers.get("test-queue")({
        content: Buffer.from("test-idp"),
        properties: {
          correlationId: "test-123",
          // replyTo missing!
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should nack and not send reply
      expect(nackCalled).toBe(true);
      expect(sendToQueueCalled).toBe(false);
    });

    it("should nack message when processing throws error", async () => {
      const channel = setupMessageConsumer(
        connection as any,
        testConfig,
      ) as any;

      let nackCalled = false;
      let sendToQueueCalled = false;
      const originalNack = channel.nack ? channel.nack.bind(channel) : () => {};
      channel.nack = (...args: any[]) => {
        nackCalled = true;
        return originalNack(...args);
      };
      channel.sendToQueue = () => {
        sendToQueueCalled = true;
        throw new Error("sendToQueue failed");
      };

      // Mock fetch to throw an error
      globalFetchSpy.mockRejectedValue(new Error("Unexpected error"));

      channel.consumers.get("test-queue")({
        content: Buffer.from("test-idp"),
        properties: {
          correlationId: "test-123",
          replyTo: "reply-queue",
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should have called nack due to sendToQueue error
      expect(nackCalled).toBe(true);
      expect(sendToQueueCalled).toBe(true);
    });
  });
});
