import {
  boolean,
  email,
  type infer as Infer,
  literal,
  number,
  object,
  string,
  union,
  uuid,
} from "zod";
const text = (max = 200) => string().trim().max(max);
export const brandSchema = object({
  name: text().min(1),
  legal_name: text(),
  vat_number: text(20),
  tax_code: text(30),
  address: text(),
  city: text(),
  country: text(2).length(2),
  commission_pct: number()
    .min(0)
    .max(100)
    .refine((value) => Number.isInteger(Math.round(value * 10000) / 100)),
  notes: text(10000),
  can_see_customer_names: boolean(),
});
export type BrandValues = Infer<typeof brandSchema>;
export const emptyBrand: BrandValues = {
  name: "",
  legal_name: "",
  vat_number: "",
  tax_code: "",
  address: "",
  city: "",
  country: "IT",
  commission_pct: 0,
  notes: "",
  can_see_customer_names: true,
};
export const contactSchema = object({
  brand_id: uuid(),
  name: text().min(1),
  role_title: text(),
  email: union([email().max(254), literal("")]),
  phone: text(40),
});
export type ContactValues = Infer<typeof contactSchema>;
