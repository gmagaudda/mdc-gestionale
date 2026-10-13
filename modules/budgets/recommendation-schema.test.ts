import { describe, expect, it } from "vitest";
import {
  historicalSourceSchema,
  recommendationSettingsSchema,
} from "./recommendation-schema";
const id = "10000000-0000-4000-8000-000000000001";
const valid = {
  brand_id: id,
  customer_id: id,
  season_id: id,
  weights: [50, 30, 20],
  growth_bps: 0,
  seasonal_threshold: 20,
  profile: "auto",
  profile_reason: "",
  historical_source: null,
  overrides: [],
};
describe("budget recommendation inputs", () => {
  it("accepts exact weights and growth without invented dates", () => {
    expect(recommendationSettingsSchema.safeParse(valid).success).toBe(true);
  });
  it.each([
    { weights: [0, 30, 20] },
    { weights: [50, 30] },
    { weights: [1.5, 30, 20] },
    { growth_bps: 10001 },
    { growth_bps: 0.5 },
    { seasonal_threshold: 0 },
    { profile: "other" },
    { profile: "summer" },
    { serviceKey: "never" },
  ])("rejects invalid configuration %j", (patch) => {
    expect(
      recommendationSettingsSchema.safeParse({ ...valid, ...patch }).success,
    ).toBe(false);
  });
  it("requires a reason for closure, zero and exceptions", () => {
    for (const state of ["closed", "zero", "excluded"]) {
      expect(
        recommendationSettingsSchema.safeParse({
          ...valid,
          overrides: [{ code: "SS27", state, source: "auto", reason: "  " }],
        }).success,
      ).toBe(false);
      expect(
        recommendationSettingsSchema.safeParse({
          ...valid,
          overrides: [
            {
              code: "SS27",
              state,
              source: "auto",
              reason: "Verificato con il cliente",
            },
          ],
        }).success,
      ).toBe(true);
    }
  });
  it("rejects duplicate seasons and more than twelve overrides", () => {
    const row = { code: "SS27", state: "missing", source: "auto", reason: "" };
    expect(
      recommendationSettingsSchema.safeParse({
        ...valid,
        overrides: [row, row],
      }).success,
    ).toBe(false);
    expect(
      recommendationSettingsSchema.safeParse({
        ...valid,
        overrides: Array(13).fill(row),
      }).success,
    ).toBe(false);
  });
  it("permits explicit identity with missing city without conflating empty customer", () => {
    const source = {
      batch_id: id,
      brand: "Brand",
      customer: "Negozio",
      city: "",
      country: "IT",
    };
    expect(historicalSourceSchema.safeParse(source).success).toBe(true);
    expect(
      historicalSourceSchema.safeParse({ ...source, customer: "" }).success,
    ).toBe(false);
  });
  it("requires a reason for an operator profile", () => {
    expect(
      recommendationSettingsSchema.safeParse({
        ...valid,
        profile: "winter",
        profile_reason: "Verifica commerciale",
      }).success,
    ).toBe(true);
  });
});
