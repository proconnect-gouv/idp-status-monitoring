// IDP_URLS

import { z } from "zod";

const parseJsonArray = z
  .string()
  .transform((str, ctx) => {
    try {
      const parsed = JSON.parse(str);
      if (!Array.isArray(parsed)) {
        ctx.addIssue({
          code: "invalid_type",
          message: "Expected JSON array",
          expected: "array",
        });
        return z.NEVER;
      }
      return parsed;
    } catch {
      ctx.addIssue({
        code: "invalid_value",
        values: [str],
      });
      return z.NEVER;
    }
  })
  .pipe(z.string().array());

export const ConfigSchema = z.object({
  AMQP_URL: z.url().default("amqp://guest:guest@rabbitmq:5672"),
  HTTP_TIMEOUT: z.coerce.number().default(5_000),
  IDP_URLS: parseJsonArray,
  PORT: z.coerce.number().default(3000),
  QUEUE_CONSUMER_NAME: z.string().default("monitoring-consumer"),
  QUEUE_PRODUCER_NAME: z.string().default("monitoring-producer"),
});

export type Config = z.output<typeof ConfigSchema>;
