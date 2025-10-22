//

import { describe, expect, it } from "bun:test";
import { InMemoryChannel, InMemoryConnection } from "./in-memory";

describe("InMemoryConnection", () => {
  it("should create a connection in connected state", () => {
    const connection = new InMemoryConnection();
    expect(connection.isConnected()).toBe(true);
  });

  it("should create channels", () => {
    const connection = new InMemoryConnection();
    const channel = connection.createChannel();
    expect(channel).toBeInstanceOf(InMemoryChannel);
    expect(channel.isClosed()).toBe(false);
  });

  it("should execute channel setup function", async () => {
    const connection = new InMemoryConnection();
    let setupCalled = false;

    connection.createChannel({
      setup: async (ch) => {
        setupCalled = true;
        await ch.assertQueue("test-queue");
      },
    });

    // Wait for setup to execute
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(setupCalled).toBe(true);
  });

  it("should close connection and all channels", async () => {
    const connection = new InMemoryConnection();
    const channel1 = connection.createChannel();
    const channel2 = connection.createChannel();

    await connection.close();

    expect(connection.isConnected()).toBe(false);
    expect(channel1.isClosed()).toBe(true);
    expect(channel2.isClosed()).toBe(true);
  });

  it("should emit close event when closed", async () => {
    const connection = new InMemoryConnection();

    const closePromise = new Promise((resolve) => {
      connection.once("close", resolve);
    });

    connection.close();
    await closePromise;

    expect(connection.isConnected()).toBe(false);
  });

  it("should throw when creating channel after close", async () => {
    const connection = new InMemoryConnection();
    await connection.close();

    expect(() => connection.createChannel()).toThrow("Connection is closed");
  });
});

describe("InMemoryChannel", () => {
  it("should assert queues", async () => {
    const connection = new InMemoryConnection();
    const channel = connection.createChannel();

    await expect(channel.assertQueue("test-queue")).resolves.toBeUndefined();
  });

  it("should reject assertQueue when channel is closed", async () => {
    const connection = new InMemoryConnection();
    const channel = connection.createChannel();
    await channel.close();

    await expect(channel.assertQueue("test-queue")).rejects.toThrow(
      "Channel is closed",
    );
  });

  it("should register consumers on asserted queues", async () => {
    const connection = new InMemoryConnection();
    const channel = connection.createChannel();

    await channel.assertQueue("test-queue");

    const consumer = () => {};
    expect(() => channel.consume("test-queue", consumer)).not.toThrow();
  });

  it("should throw when consuming from non-asserted queue", async () => {
    const connection = new InMemoryConnection();
    const channel = connection.createChannel();

    const consumer = () => {};
    expect(() => channel.consume("unknown-queue", consumer)).toThrow(
      "Queue unknown-queue not asserted",
    );
  });

  it("should throw when consuming after channel close", async () => {
    const connection = new InMemoryConnection();
    const channel = connection.createChannel();
    await channel.assertQueue("test-queue");
    await channel.close();

    const consumer = () => {};
    expect(() => channel.consume("test-queue", consumer)).toThrow(
      "Channel is closed",
    );
  });

  it("should send messages to queue consumers", async () => {
    const connection = new InMemoryConnection();
    const channel = connection.createChannel();

    await channel.assertQueue("test-queue");

    const receivedMessages: any[] = [];
    channel.consume("test-queue", (message) => {
      receivedMessages.push(message);
    });

    channel.sendToQueue("test-queue", "test message", {
      correlationId: "test-123",
    });

    // Wait for async delivery
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(receivedMessages.length).toBe(1);
    expect(receivedMessages[0].content.toString()).toBe("test message");
    expect(receivedMessages[0].properties.correlationId).toBe("test-123");
  });

  it("should emit message-sent event when sending messages", async () => {
    const connection = new InMemoryConnection();
    const channel = connection.createChannel();

    await channel.assertQueue("test-queue");

    const sentMessages: any[] = [];
    channel.on("message-sent", (msg) => {
      sentMessages.push(msg);
    });

    channel.sendToQueue("test-queue", "test message", {
      correlationId: "test-123",
    });

    expect(sentMessages.length).toBe(1);
    expect(sentMessages[0].queueName).toBe("test-queue");
    expect(sentMessages[0].content).toBe("test message");
    expect(sentMessages[0].options.correlationId).toBe("test-123");
  });

  it("should handle Buffer content in sendToQueue", async () => {
    const connection = new InMemoryConnection();
    const channel = connection.createChannel();

    await channel.assertQueue("test-queue");

    const receivedMessages: any[] = [];
    channel.consume("test-queue", (message) => {
      receivedMessages.push(message);
    });

    const buffer = Buffer.from("buffer message");
    channel.sendToQueue("test-queue", buffer, {});

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(receivedMessages[0].content.toString()).toBe("buffer message");
  });

  it("should throw when sending to closed channel", async () => {
    const connection = new InMemoryConnection();
    const channel = connection.createChannel();
    await channel.close();

    expect(() =>
      channel.sendToQueue("test-queue", "message", {}),
    ).toThrow("Channel is closed");
  });

  it("should support ack operation (no-op)", async () => {
    const connection = new InMemoryConnection();
    const channel = connection.createChannel();

    const message = {
      content: Buffer.from("test"),
      properties: {},
    };

    expect(() => channel.ack(message)).not.toThrow();
  });

  it("should support nack operation (no-op)", async () => {
    const connection = new InMemoryConnection();
    const channel = connection.createChannel();

    const message = {
      content: Buffer.from("test"),
      properties: {},
    };

    expect(() => channel.nack(message)).not.toThrow();
    expect(() => channel.nack(message, true, false)).not.toThrow();
  });

  it("should deliver messages via emit('deliver-message')", async () => {
    const connection = new InMemoryConnection();
    const channel = connection.createChannel();

    await channel.assertQueue("test-queue");

    const receivedMessages: any[] = [];
    channel.consume("test-queue", (message) => {
      receivedMessages.push(message);
    });

    // Use emit to manually deliver message (for testing)
    channel.emit("deliver-message", "test-queue", "manual message", {
      correlationId: "manual-123",
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(receivedMessages.length).toBe(1);
    expect(receivedMessages[0].content.toString()).toBe("manual message");
  });

  it("should close channel and emit close event", async () => {
    const connection = new InMemoryConnection();
    const channel = connection.createChannel();

    const closePromise = new Promise((resolve) => {
      channel.once("close", resolve);
    });

    channel.close();
    await closePromise;

    expect(channel.isClosed()).toBe(true);
  });

  it("should clear consumers when channel closes", async () => {
    const connection = new InMemoryConnection();
    const channel = connection.createChannel();

    await channel.assertQueue("test-queue");

    const receivedMessages: any[] = [];
    channel.consume("test-queue", (message) => {
      receivedMessages.push(message);
    });

    await channel.close();

    // Try to send message after close - should throw
    expect(() => channel.sendToQueue("test-queue", "message", {})).toThrow(
      "Channel is closed",
    );
  });
});
