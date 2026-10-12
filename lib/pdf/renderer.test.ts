import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  PrintPdfRenderer,
  wrapPdfText,
  UnsupportedPdfCharacters,
} from "./renderer";
import type { OrderPdf } from "./types";
import messages from "@/messages/it.json";
const fontBytes = new Uint8Array(
  readFileSync("public/fonts/Inter-Regular.ttf"),
);
const labels = {
  ...messages.orders,
  ...messages.pdf,
  variant: messages.pdf.variant,
  page: messages.pdf.page,
} as unknown as Record<string, string>;
const order: OrderPdf = {
  type: "order-confirmation",
  title: "Conferma ordine ORD-2026-00001",
  brand: "Marchio prova",
  season: "FW26: Autunno inverno",
  customer: "Cliente riservato",
  date: "12/10/2026",
  delivery: "Non impostata",
  status: "Confermato",
  payment: "30 giorni",
  discount: 0,
  lines: [
    {
      name: "Camicia qualità",
      sku: "CAMICIA-BLU-M",
      variant: "Blu / M",
      quantity: 2,
      price: 1999,
      discount: 0,
      net: 3998,
    },
  ],
  net: 3998,
  vat: 880,
  gross: 4878,
  labels,
};
describe("print PDF", () => {
  it("wraps long unbroken SKUs without losing text or exceeding a column", async () => {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const font = await doc.embedFont(fontBytes);
    const sku = "CAMICIA".repeat(40);
    const lines = wrapPdfText(sku, font, 9, 75);
    expect(lines.join("")).toBe(sku);
    expect(lines.every((line) => font.widthOfTextAtSize(line, 9) <= 75)).toBe(
      true,
    );
    expect(() => wrapPdfText("Camicia 🪡", font, 9, 75)).toThrow(
      UnsupportedPdfCharacters,
    );
  });
  it("creates an embedded-font A4 order and paginates many rows", async () => {
    const renderer = new PrintPdfRenderer(fontBytes);
    const single = await PDFDocument.load(
      await renderer.render(order.type, order),
    );
    expect(single.getPageCount()).toBe(1);
    expect(single.getTitle()).toBe(order.title);
    expect(single.getPages()[0].getWidth()).toBeCloseTo(595.28);
    const many = {
      ...order,
      lines: Array.from({ length: 100 }, (_, i) => ({
        ...order.lines[0],
        sku: `CAMICIA-${i}`,
      })),
    };
    const bytes = await renderer.render(many.type, many);
    if (process.env.PDF_LAYOUT_CHECK) {
      mkdirSync("tmp/pdfs", { recursive: true });
      writeFileSync("tmp/pdfs/many-rows.pdf", bytes);
    }
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(4);
    expect(doc.getPages().every((page) => page.getHeight() === 841.89)).toBe(
      true,
    );
  });
});
