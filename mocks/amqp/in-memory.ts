//

import { EventEmitter } from "node:events";

export class InMemoryChannel extends EventEmitter {
  private consumers = new Map<string, (message: any) => void>();

  assertQueue(_queueName: string, _options?: any) {
    return Promise.resolve();
  }

  consume(queueName: string, callback: (message: any) => void) {
    this.consumers.set(queueName, callback);
  }

  sendToQueue(queueName: string, content: string, options: any) {
    // Emit for response testing
    this.emit("message-sent", { queueName, content, options });

    // Also deliver to any consumers for the target queue
    const consumer = this.consumers.get(queueName);
    if (consumer) {
      const message = {
        content: Buffer.from(content),
        properties: options,
      };
      setImmediate(() => consumer(message));
    }
  }

  ack(_message: any) {
    // No-op for in-memory implementation
  }

  // Override emit to handle message delivery for testing
  emit(event: string | symbol, ...args: any[]): boolean {
    if (event === "deliver-message") {
      const [queueName, content, properties] = args;
      const consumer = this.consumers.get(queueName);
      if (consumer) {
        const message = {
          content: Buffer.from(content),
          properties,
        };
        setImmediate(() => consumer(message));
      }
      return true;
    }
    return super.emit(event, ...args);
  }
}

export class InMemoryConnection extends EventEmitter {
  createChannel(config?: { setup?: (channel: any) => Promise<any> }) {
    const channel = new InMemoryChannel();

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
}
