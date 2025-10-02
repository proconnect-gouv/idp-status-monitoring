// IDP_URLS

import { z } from "zod";

const parseJsonArray = z
  .string()
  .transform((str, ctx) => {
    try {
      const parsed = JSON.parse(str);
      if (!Array.isArray(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Expected JSON array",
        });
        return z.NEVER;
      }
      return parsed;
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid JSON",
      });
      return z.NEVER;
    }
  })
  .pipe(z.string().array());

export const ConfigSchema = z.object({
  AMQP_URL: z.url().default("amqp://guest:guest@rabbitmq:5672"),
  HTTP_TIMEOUT: z.coerce.number().default(5_000),
  IDP_URLS: z
    .union([z.string().array(), parseJsonArray])
    .default([])
    .transform((val) => (typeof val === "string" ? JSON.parse(val) : val)),
  PORT: z.coerce.number().default(3000),
  QUEUE_CONSUMER_NAME: z.string().default("monitoring-consumer"),
  QUEUE_PRODUCER_NAME: z.string().default("monitoring-producer"),
});

export type Config = z.output<typeof ConfigSchema>;
