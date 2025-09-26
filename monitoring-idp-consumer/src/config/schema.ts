// IDP_URLS

import { z } from "zod";

export const ConfigSchema = z.object({
  AMQP_URL: z.url().default("amqp://guest:guest@rabbitmq:5672"),
  HTTP_ACCEPT: z.string().default("*/*"),
  HTTP_TIMEOUT: z.coerce.number().default(5_000),
  HTTP_USER_AGENT: z
    .string()
    .default("Sonde AgentConnect https://status.agentconnect.gouv.fr/"),
  IDP_URLS: z.string().array().default([]),
  MAP_FI_NAMES_TO_URL: z.record(z.string(), z.string()).default({}),
  QUEUE_CONSUMER_NAME: z.string().default("monitoring-consumer"),
  QUEUE_PRODUCER_NAME: z.string().default("monitoring-producer"),
});

export type Config = z.output<typeof ConfigSchema>;
