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
  });
});
