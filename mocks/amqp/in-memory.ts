//

import { EventEmitter } from "node:events";

/**
 * Message structure matching amqplib format
 */
export interface InMemoryMessage {
  content: Buffer;
  properties: {
    correlationId?: string;
    replyTo?: string;
    [key: string]: any;
  };
}

/**
 * Consumer callback type
 */
export type ConsumerCallback = (message: InMemoryMessage) => void;

/**
 * Channel setup configuration
 */
export interface ChannelConfig {
  setup?: (channel: InMemoryChannel) => Promise<void>;
}

/**
 * In-memory AMQP channel implementation for testing
 * Mimics the behavior of amqplib Channel for unit tests
 */
export class InMemoryChannel extends EventEmitter {
  private consumers = new Map<string, ConsumerCallback>();
  private queues = new Set<string>();
  private closed = false;

  /**
   * Assert that a queue exists (create if it doesn't)
   */
  assertQueue(queueName: string, _options?: any): Promise<void> {
    if (this.closed) {
      return Promise.reject(new Error("Channel is closed"));
    }
    this.queues.add(queueName);
    return Promise.resolve();
  }

  /**
   * Register a consumer for a queue
   */
  consume(queueName: string, callback: ConsumerCallback): void {
    if (this.closed) {
      throw new Error("Channel is closed");
    }
    if (!this.queues.has(queueName)) {
      throw new Error(`Queue ${queueName} not asserted`);
    }
    this.consumers.set(queueName, callback);
  }

  /**
   * Send a message to a queue
   */
  sendToQueue(
    queueName: string,
    content: string | Buffer,
    options: Record<string, any> = {},
  ): void {
    if (this.closed) {
      throw new Error("Channel is closed");
    }

    // Emit for response testing
    this.emit("message-sent", {
      queueName,
      content: typeof content === "string" ? content : content.toString(),
      options,
    });

    // Also deliver to any consumers for the target queue
    const consumer = this.consumers.get(queueName);
    if (consumer) {
      const message: InMemoryMessage = {
        content:
          typeof content === "string" ? Buffer.from(content) : content,
        properties: options,
      };
      setImmediate(() => consumer(message));
    }
  }

  /**
   * Acknowledge a message (no-op in memory implementation)
   */
  ack(_message: InMemoryMessage): void {
    // No-op for in-memory implementation
  }

  /**
   * Negative acknowledge a message (no-op in memory implementation)
   */
  nack(_message: InMemoryMessage, _allUpTo?: boolean, _requeue?: boolean): void {
    // No-op for in-memory implementation
  }

  /**
   * Close the channel
   */
  close(): Promise<void> {
    this.closed = true;
    this.consumers.clear();
    this.emit("close");
    return Promise.resolve();
  }

  /**
   * Check if channel is closed
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * Override emit to handle message delivery for testing
   * Allows tests to manually trigger message delivery
   */
  override emit(event: string | symbol, ...args: any[]): boolean {
    if (event === "deliver-message") {
      const [queueName, content, properties] = args;
      const consumer = this.consumers.get(queueName);
      if (consumer) {
        const message: InMemoryMessage = {
          content:
            typeof content === "string" ? Buffer.from(content) : content,
          properties,
        };
        setImmediate(() => consumer(message));
      }
      return true;
    }
    return super.emit(event, ...args);
  }
}

/**
 * In-memory AMQP connection implementation for testing
 * Mimics the behavior of amqplib Connection for unit tests
 */
export class InMemoryConnection extends EventEmitter {
  private channels: InMemoryChannel[] = [];
  private connected = true;

  /**
   * Create a new channel
   */
  createChannel(config?: ChannelConfig): InMemoryChannel {
    if (!this.connected) {
      throw new Error("Connection is closed");
    }

    const channel = new InMemoryChannel();
    this.channels.push(channel);

    if (config?.setup) {
      setImmediate(async () => {
        try {
          await config.setup!(channel);
        } catch (err) {
          this.emit("error", err);
        }
      });
    }

    return channel;
  }

  /**
   * Close the connection
   */
  close(): Promise<void> {
    this.connected = false;
    for (const channel of this.channels) {
      channel.close();
    }
    this.channels = [];
    this.emit("close");
    return Promise.resolve();
  }

  /**
   * Check if connection is open
   */
  isConnected(): boolean {
    return this.connected;
  }
}
