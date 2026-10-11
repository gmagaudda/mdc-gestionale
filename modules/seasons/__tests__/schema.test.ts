import { it, expect } from "vitest";
import { seasonSchema, emptySeason } from "../schema";
const valid = {
  ...emptySeason,
  brand_id: "00000000-0000-4000-8000-000000000001",
  code: "FW26",
  name: "Autunno",
};
it("validates dates and campaign ranges", () => {
  expect(seasonSchema.safeParse(valid).success).toBe(true);
  expect(
    seasonSchema.safeParse({
      ...valid,
      campaign_start: "2026-09-01",
      campaign_end: "2026-08-01",
    }).success,
  ).toBe(false);
  expect(
    seasonSchema.safeParse({ ...valid, delivery_start: "2026-02-30" }).success,
  ).toBe(false);
});
