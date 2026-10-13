import type { z } from "zod";
import type { brandSummarySchema } from "./summary-schema";
export type PdfType = "order-confirmation" | "line-sheet" | "brand-summary";
export type PdfLine = {
  name: string;
  sku: string;
  variant: string;
  quantity: number;
  price: number;
  discount: number;
  net: number;
};
export type OrderPdf = {
  type: "order-confirmation";
  title: string;
  brand: string;
  season: string;
  customer: string;
  date: string;
  delivery: string;
  status: string;
  payment: string;
  discount: number;
  lines: PdfLine[];
  net: number;
  vat: number;
  gross: number;
  labels: Record<string, string>;
};
export type LineSheetPdf = {
  type: "line-sheet";
  title: string;
  brand: string;
  season: string;
  products: {
    name: string;
    sku: string;
    description: string;
    price: number;
    retail: number;
    vat: number;
    variants: string[];
  }[];
  labels: Record<string, string>;
};
export type BrandSummaryPdf = {
  type: "brand-summary";
  title: string;
  brand: string;
  season: string;
  period: string;
  report: z.infer<typeof brandSummarySchema>;
  labels: Record<string, string>;
};
export type PdfData = OrderPdf | LineSheetPdf | BrandSummaryPdf;
