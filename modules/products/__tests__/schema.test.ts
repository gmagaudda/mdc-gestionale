import { describe, it, expect } from "vitest";
import { productSchema, emptyProduct } from "../schema";
const valid = {
  ...emptyProduct,
  brand_id: "00000000-0000-4000-8000-000000000001",
  season_id: "00000000-0000-4000-8000-000000000002",
  name: "Camicia",
  sku_base: "SHIRT",
  sizes: ["XS", "S", "M", "L", "XL"],
  colors: ["Bianco", "Blu", "Nero"],
};
describe("catalog validation", () => {
  it("accepts five by three variants", () =>
    expect(productSchema.safeParse(valid).success).toBe(true));
  it("rejects duplicates empty labels and noninteger cents", () => {
    for (const data of [
      { sizes: ["M", " M "] },
      { colors: [] },
      { wholesale_price_cents: 0.5 },
      { vat_rate: 100.01 },
    ])
      expect(productSchema.safeParse({ ...valid, ...data }).success).toBe(
        false,
      );
  });
});
