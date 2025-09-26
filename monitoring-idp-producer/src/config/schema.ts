// IDP_URLS

import { z } from "zod";

export const ConfigSchema = z.object({
  AMQP_URL: z.url().default("amqp://guest:guest@rabbitmq:5672"),
  HTTP_TIMEOUT: z.coerce.number().default(5_000),
  IDP_URLS: z.string().array().default([]),
  QUEUE_CONSUMER_NAME: z.string().default("monitoring-consumer"),
  QUEUE_PRODUCER_NAME: z.string().default("monitoring-producer"),
});

export type Config = z.output<typeof ConfigSchema>;
