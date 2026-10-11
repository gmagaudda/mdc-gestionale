import {
  object,
  string,
  email,
  union,
  literal,
  uuid,
  type infer as Infer,
} from "zod";
const text = (max = 200) => string().trim().max(max);
const optionalEmail = union([email().max(254), literal("")]);
export const addressSchema = object({
  street: text().default(""),
  postal_code: text(20).default(""),
  city: text().default(""),
  province: text(10).default(""),
  country: text(2)
    .regex(/^[A-Z]{2}$/)
    .default("IT"),
});
export const customerSchema = object({
  legal_name: text().min(1),
  trade_name: text(),
  vat_number: text(11).refine((value) => !value || /^\d{11}$/.test(value)),
  tax_code: text(30),
  sdi_code: text(7).refine((value) => !value || /^[A-Z0-9]{7}$/.test(value)),
  pec: optionalEmail,
  billing_address: addressSchema,
  shipping_address: addressSchema,
  payment_terms: text(500),
  notes: text(10000),
});
export type CustomerValues = Infer<typeof customerSchema>;
export const emptyAddress = {
  street: "",
  postal_code: "",
  city: "",
  province: "",
  country: "IT",
};
export const emptyCustomer: CustomerValues = {
  legal_name: "",
  trade_name: "",
  vat_number: "",
  tax_code: "",
  sdi_code: "",
  pec: "",
  billing_address: { ...emptyAddress },
  shipping_address: { ...emptyAddress },
  payment_terms: "",
  notes: "",
};
export const customerContactSchema = object({
  customer_id: uuid(),
  name: text().min(1),
  role_title: text(),
  email: optionalEmail,
  phone: text(40),
});
export type CustomerContactValues = Infer<typeof customerContactSchema>;
