export type PdfType = "order-confirmation" | "line-sheet";
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
export type PdfData = OrderPdf | LineSheetPdf;
export interface PdfRenderer {
  render(type: PdfType, data: PdfData): Promise<Uint8Array>;
}
