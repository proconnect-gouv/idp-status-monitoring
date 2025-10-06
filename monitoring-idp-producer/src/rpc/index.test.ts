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
  });
});
