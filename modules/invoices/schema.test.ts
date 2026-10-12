import { it, expect } from "vitest";
import { generateInvoiceSchema, paymentSchema } from "./schema";
it("validates invoice dates and exact payment cents", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  expect(
    generateInvoiceSchema.safeParse({
      orderId: id,
      issueDate: "2033-01-02",
      dueDate: "2033-01-01",
    }).success,
  ).toBe(false);
  const input = {
    invoiceId: id,
    idempotencyKey: id,
    amount: "14,40",
    paidDate: "2033-01-01",
    method: "cash",
    note: "",
  };
  expect(paymentSchema.parse(input).amount).toBe(1440);
  for (const amount of ["0", "-1", "1,001", "1.000,00", "Infinity"])
    expect(paymentSchema.safeParse({ ...input, amount }).success).toBe(false);
});
