import { expect, it } from "vitest";
import { brandSchema, emptyBrand, contactSchema } from "./schema";
it("validates names and commission bounds without silently rounding", () => {
  expect(
    brandSchema.safeParse({
      ...emptyBrand,
      name: " Brand ",
      commission_pct: 12.25,
    }).success,
  ).toBe(true);
  for (const value of [-1, 100.01, 12.345, NaN])
    expect(
      brandSchema.safeParse({
        ...emptyBrand,
        name: "Brand",
        commission_pct: value,
      }).success,
    ).toBe(false);
  expect(brandSchema.safeParse(emptyBrand).success).toBe(false);
});
it("validates contact identity and optional email", () => {
  const contact = {
    brand_id: "00000000-0000-4000-8000-000000000001",
    name: "Buyer",
    role_title: "",
    email: "",
    phone: "",
  };
  expect(contactSchema.safeParse(contact).success).toBe(true);
  expect(
    contactSchema.safeParse({ ...contact, email: "invalid" }).success,
  ).toBe(false);
  expect(
    contactSchema.safeParse({ ...contact, brand_id: "invalid" }).success,
  ).toBe(false);
});
