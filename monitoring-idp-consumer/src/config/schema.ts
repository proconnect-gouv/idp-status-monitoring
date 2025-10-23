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

const parseJsonRecord = z
  .string()
  .transform((str, ctx) => {
    try {
      const parsed = JSON.parse(str);
      if (typeof parsed !== "object" || Array.isArray(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Expected JSON object",
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
  .pipe(z.record(z.string(), z.string()));

export const ConfigSchema = z.object({
  AMQP_URL: z.url().default("amqp://guest:guest@rabbitmq:5672"),
  HTTP_ACCEPT: z.string().default("*/*"),
  HTTP_TIMEOUT: z.coerce.number().default(5_000),
  HTTP_USER_AGENT: z
    .string()
    .default("Sonde AgentConnect https://status.agentconnect.gouv.fr/"),
  HTTPS_PROXY: z.string().optional(),
  IDP_URLS: z
    .union([z.string().array(), parseJsonArray])
    .default([])
    .transform((val) => (typeof val === "string" ? JSON.parse(val) : val)),
  MAP_FI_NAMES_TO_URL: z
    .union([z.record(z.string(), z.string()), parseJsonRecord])
    .default({})
    .transform((val) => (typeof val === "string" ? JSON.parse(val) : val)),
  PORT: z.coerce.number().default(80),
  QUEUE_CONSUMER_NAME: z.string().default("monitoring-consumer"),
  QUEUE_PRODUCER_NAME: z.string().default("monitoring-producer"),
});

export type Config = z.output<typeof ConfigSchema>;
