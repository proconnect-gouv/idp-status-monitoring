//

import { ConfigSchema } from "#src/config";
import { createAmqpConnection, setupMessageConsumer } from "#src/rpc";

console.log("Starting monitoring-idp-consumer...");

// Load configuration
const config = await ConfigSchema.parseAsync(process.env);

// Setup consumer
const connection = await createAmqpConnection(config.AMQP_URL);
setupMessageConsumer(connection, config);

console.log("Consumer started successfully!");
