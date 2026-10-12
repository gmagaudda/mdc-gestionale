import { z } from "zod";
import { romeToUtc } from "@/lib/dates/rome";
export const eventTypes = [
  "appointment",
  "campaign",
  "delivery",
  "payment_due",
  "other",
] as const;
const optionalId = z.union([z.uuid(), z.literal("")]);
export const eventSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    type: z.enum(eventTypes),
    description: z.string().max(5000),
    starts_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    ends_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    all_day: z.boolean(),
    brand_id: optionalId,
    customer_id: optionalId,
    assigned_to: optionalId,
    visible_to_brand: z.boolean(),
    location: z.string().max(500),
  })
  .superRefine((value, ctx) => {
    let start: number | undefined, end: number | undefined;
    for (const key of ["starts_at", "ends_at"] as const) {
      try {
        const stamp = Date.parse(romeToUtc(value[key]));
        if (key === "starts_at") start = stamp;
        else end = stamp;
      } catch {
        ctx.addIssue({ code: "custom", path: [key], message: "timeInvalid" });
      }
    }
    if (
      start !== undefined &&
      end !== undefined &&
      (end <= start || end - start > 366 * 86400000)
    )
      ctx.addIssue({ code: "custom", path: ["ends_at"], message: "dateRange" });
    if (
      value.all_day &&
      (!value.starts_at.endsWith("T00:00") || !value.ends_at.endsWith("T00:00"))
    )
      ctx.addIssue({
        code: "custom",
        path: ["starts_at"],
        message: "allDayInvalid",
      });
    if (value.visible_to_brand && !value.brand_id)
      ctx.addIssue({
        code: "custom",
        path: ["brand_id"],
        message: "sharedNeedsBrand",
      });
  });
export type EventInput = z.infer<typeof eventSchema>;
export const eventRangeSchema = z
  .object({
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
    brand_id: optionalId.default(""),
    customer_id: optionalId.default(""),
    assigned_to: optionalId.default(""),
    type: z.union([z.enum(eventTypes), z.literal("")]).default(""),
  })
  .refine(
    (v) =>
      Date.parse(v.end) > Date.parse(v.start) &&
      Date.parse(v.end) - Date.parse(v.start) <= 93 * 86400000,
  );
export const moveEventSchema = z
  .object({
    id: z.uuid(),
    starts_at: z.iso.datetime({ offset: true }),
    ends_at: z.iso.datetime({ offset: true }),
    all_day: z.boolean(),
    updated_at: z.iso.datetime({ offset: true }),
  })
  .refine(
    (v) =>
      Date.parse(v.ends_at) > Date.parse(v.starts_at) &&
      Date.parse(v.ends_at) - Date.parse(v.starts_at) <= 366 * 86400000,
  );
