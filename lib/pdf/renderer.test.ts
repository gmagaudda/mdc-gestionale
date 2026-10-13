import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { renderPdf, wrapPdfText, UnsupportedPdfCharacters } from "./renderer";
import type { OrderPdf, BrandSummaryPdf } from "./types";
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
  it("prints SQL summary strings beyond safe integers and repeats headings across A4 pages", async () => {
    const summary: BrandSummaryPdf = {
      type: "brand-summary",
      title: "Riepilogo vendite brand",
      brand: "Marchio prova",
      season: "Tutte le stagioni",
      period: "Tutte le date ordine",
      labels: {
        ...labels,
        season: "Stagione",
        customer: "Cliente",
        orders: "Ordini",
        empty: "Nessun ordine",
        definition: "Ordini confermati e successivi",
      },
      report: {
        count: 100,
        order_count: 100,
        net_cents: "9007199254740993",
        vat_cents: "0",
        gross_cents: "9007199254740993",
        rows: Array.from({ length: 100 }, () => ({
          season_code: "FW26",
          customer: "Cliente riservato",
          city: "",
          order_count: 1,
          net_cents: "9007199254740993",
          vat_cents: "0",
          gross_cents: "9007199254740993",
        })),
      },
    };
    const bytes = await renderPdf(summary, fontBytes);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
    expect(doc.getTitle()).toBe(summary.title);
    expect(doc.getAuthor()).toBe("MDC Gestionale");
    expect(doc.getPages().every((page) => page.getHeight() === 841.89)).toBe(
      true,
    );
    if (process.env.PDF_LAYOUT_CHECK) {
      mkdirSync("tmp/pdfs", { recursive: true });
      writeFileSync("tmp/pdfs/brand-summary-many.pdf", bytes);
    }
    const empty = await PDFDocument.load(
      await renderPdf(
        {
          ...summary,
          report: {
            count: 0,
            order_count: 0,
            net_cents: "0",
            vat_cents: "0",
            gross_cents: "0",
            rows: [],
          },
        },
        fontBytes,
      ),
    );
    expect(empty.getPageCount()).toBe(1);
  });
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
    const single = await PDFDocument.load(await renderPdf(order, fontBytes));
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
    const bytes = await renderPdf(many, fontBytes);
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
