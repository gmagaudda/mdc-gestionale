import { z } from "zod";
const eventSchema = z.enum([
  "email.logged",
  "reminders.finished",
  "push.finished",
  "invoicing.finished",
  "retention.finished",
]);
const statusSchema = z.enum(["ok", "retry", "error"]);
const metricsSchema = z
  .object({
    sent: z.number().int().nonnegative().optional(),
    logged: z.number().int().nonnegative().optional(),
    failed: z.number().int().nonnegative().optional(),
    completed: z.number().int().nonnegative().optional(),
    removed: z.number().int().nonnegative().optional(),
    more: z.boolean().optional(),
    duration_ms: z.number().nonnegative().optional(),
  })
  .strip();
export function operationalLog(
  event:
    | "email.logged"
    | "reminders.finished"
    | "push.finished"
    | "invoicing.finished"
    | "retention.finished",
  status: "ok" | "retry" | "error",
  metrics: z.input<typeof metricsSchema> = {},
) {
  return {
    timestamp: new Date().toISOString(),
    event: eventSchema.parse(event),
    status: statusSchema.parse(status),
    ...metricsSchema.parse(metrics),
  };
}
