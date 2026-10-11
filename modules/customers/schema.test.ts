import { expect, it } from "vitest";
import { customerSchema, emptyCustomer } from "./schema";
it("validates Italian VAT length, SDI and PEC while permitting incomplete draft details", () => {
  const data = { ...emptyCustomer, legal_name: "Boutique" };
  expect(customerSchema.safeParse(data).success).toBe(true);
  for (const vat_number of ["1234567890", "123456789012", "1234567890A"])
    expect(customerSchema.safeParse({ ...data, vat_number }).success).toBe(
      false,
    );
  expect(
    customerSchema.safeParse({
      ...data,
      vat_number: "01234567890",
      sdi_code: "ABC1234",
      pec: "store@example.test",
    }).success,
  ).toBe(true);
  for (const sdi_code of ["ABC123", "ABC12345", "abc1234"])
    expect(customerSchema.safeParse({ ...data, sdi_code }).success).toBe(false);
  expect(customerSchema.safeParse({ ...data, pec: "invalid" }).success).toBe(
    false,
  );
});
it("checks both addresses and prevents empty legal names", () => {
  expect(
    customerSchema.safeParse({ ...emptyCustomer, legal_name: "  " }).success,
  ).toBe(false);
  expect(
    customerSchema.safeParse({
      ...emptyCustomer,
      legal_name: "Store",
      shipping_address: { ...emptyCustomer.shipping_address, country: "Italy" },
    }).success,
  ).toBe(false);
});
