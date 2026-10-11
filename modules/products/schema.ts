import { object, string, uuid, number, array, type infer as Infer } from "zod";
import { MAX_CENTS } from "@/lib/money";
const labels = (length: number) =>
  array(string().trim().min(1).max(length))
    .min(1)
    .max(30)
    .refine((value) => new Set(value).size === value.length);
export const productSchema = object({
  brand_id: uuid(),
  season_id: uuid(),
  sku_base: string().trim().min(1).max(80),
  name: string().trim().min(1).max(200),
  description: string().trim().max(10000),
  wholesale_price_cents: number().int().min(0).max(MAX_CENTS),
  retail_price_cents: number().int().min(0).max(MAX_CENTS),
  vat_rate: number().min(0).max(100).multipleOf(0.01),
  sizes: labels(40),
  colors: labels(80),
});
export type ProductValues = Infer<typeof productSchema>;
export const emptyProduct: ProductValues = {
  brand_id: "",
  season_id: "",
  sku_base: "",
  name: "",
  description: "",
  wholesale_price_cents: 0,
  retail_price_cents: 0,
  vat_rate: 22,
  sizes: [],
  colors: [],
};
