import { expect, it } from "vitest";
import { eventSchema, eventRangeSchema } from "./schema";
const event = {
  title: "Appuntamento",
  type: "appointment",
  description: "",
  starts_at: "2026-10-12T09:00",
  ends_at: "2026-10-12T10:00",
  all_day: false,
  brand_id: "",
  customer_id: "",
  assigned_to: "",
  visible_to_brand: false,
  location: "",
};
it("validates event dates and sharing independently of UI", () => {
  expect(eventSchema.safeParse(event).success).toBe(true);
  expect(
    eventSchema.safeParse({ ...event, ends_at: event.starts_at }).success,
  ).toBe(false);
  expect(
    eventSchema.safeParse({ ...event, visible_to_brand: true }).success,
  ).toBe(false);
  expect(eventSchema.safeParse({ ...event, all_day: true }).success).toBe(
    false,
  );
  expect(
    eventSchema.safeParse({
      ...event,
      starts_at: "2026-10-25T02:00",
      ends_at: "2026-10-25T03:00",
    }).success,
  ).toBe(false);
  expect(
    eventRangeSchema.safeParse({
      start: "2026-01-01T00:00:00Z",
      end: "2027-01-01T00:00:00Z",
    }).success,
  ).toBe(false);
  expect(
    eventRangeSchema.safeParse({
      start: "2026-01-01T00:00:00Z",
      end: "2026-02-01T00:00:00Z",
      brand_id: "invalid",
    }).success,
  ).toBe(false);
});
