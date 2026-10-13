import { PDFDocument, grayscale, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { formatMoney } from "@/lib/money";
import type { PdfData } from "./types";
const pageWidth = 595.28,
  pageHeight = 841.89,
  margin = 36,
  contentWidth = pageWidth - margin * 2;
// Print palette follows Arc's neutral light surfaces, independent of the app theme.
const ink = grayscale(0.05),
  muted = grayscale(0.35),
  border = grayscale(0.85);
export class UnsupportedPdfCharacters extends Error {}
const characterSets = new WeakMap<PDFFont, Set<number>>();
export function wrapPdfText(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
) {
  let supported = characterSets.get(font);
  if (!supported) {
    supported = new Set(font.getCharacterSet());
    characterSets.set(font, supported);
  }
  for (const char of text) {
    if (
      !/\s|[\u0000-\u001f]/.test(char) &&
      !supported.has(char.codePointAt(0)!)
    )
      throw new UnsupportedPdfCharacters("Unsupported PDF character");
  }
  const result: string[] = [];
  for (const paragraph of text
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      if (font.widthOfTextAtSize(word, size) > width) {
        if (line) {
          result.push(line);
          line = "";
        }
        for (const char of word) {
          if (line && font.widthOfTextAtSize(line + char, size) > width) {
            result.push(line);
            line = "";
          }
          line += char;
        }
      } else if (
        line &&
        font.widthOfTextAtSize(`${line} ${word}`, size) > width
      ) {
        result.push(line);
        line = word;
      } else line += `${line ? " " : ""}${word}`;
    }
    result.push(line);
  }
  return result;
}
export async function renderPdf(data: PdfData, fontBytes: Uint8Array) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });
  doc.setTitle(data.title);
  doc.setAuthor("MDC Gestionale");
  doc.setLanguage("it-IT");
  let page: PDFPage;
  let y = 0;
  const newPage = () => {
    page = doc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };
  newPage();
  const ensure = (height: number) => {
    if (y - height < margin + 24) newPage();
  };
  const text = (value: string, size = 10, gap = 8) => {
    const lines = wrapPdfText(value, font, size, contentWidth);
    for (const line of lines) {
      ensure(size * 1.5);
      y -= size * 1.5;
      page.drawText(line, { x: margin, y, size, font, color: ink });
    }
    y -= gap;
  };
  const table = (
    widths: number[],
    headings: string[],
    rows: string[][],
    emptyMessage: string,
  ) => {
    const row = (values: string[], header = false) => {
      const cells = values.map((value, i) =>
        wrapPdfText(value, font, 9, widths[i] - 10),
      );
      const height = Math.max(...cells.map((cell) => cell.length)) * 13 + 16;
      if (y - height < margin + 24) {
        newPage();
        if (!header) row(headings, true);
      }
      let x = margin;
      cells.forEach((lines, i) => {
        lines.forEach((line, j) => {
          const right = i >= 2;
          page.drawText(line, {
            x: right
              ? x + widths[i] - 8 - font.widthOfTextAtSize(line, 9)
              : x + 4,
            y: y - 13 - j * 13,
            size: 9,
            font,
            color: header ? muted : ink,
          });
        });
        x += widths[i];
      });
      y -= height;
      page.drawLine({
        start: { x: margin, y },
        end: { x: margin + contentWidth, y },
        thickness: 0.5,
        color: border,
      });
    };
    row(headings, true);
    if (!rows.length) text(emptyMessage);
    for (const values of rows) row(values);
  };
  text(data.title, 22, 16);
  text(data.brand, 14, 8);
  text(data.season, 11, 16);
  if (data.type === "order-confirmation") {
    const l = data.labels;
    text(`${l.customer}: ${data.customer}`);
    text(
      `${l.order_date}: ${data.date}   ${l.delivery_date}: ${data.delivery}`,
    );
    text(`${l.status}: ${data.status}`);
    text(`${l.payment_terms}: ${data.payment}`);
    text(
      `${l.discount_pct}: ${new Intl.NumberFormat("it-IT").format(data.discount)}%`,
      10,
      16,
    );
    const widths = [166, 80, 49, 78, 65, contentWidth - 438];
    const headings = [
      l.products,
      l.variant,
      l.quantity,
      l.unit_price_cents,
      l.line_discount_pct,
      l.net,
    ];
    table(
      widths,
      headings,
      data.lines.map((line) => [
        `${line.name}\n${line.sku}`,
        line.variant,
        String(line.quantity),
        formatMoney(line.price),
        `${new Intl.NumberFormat("it-IT").format(line.discount)}%`,
        formatMoney(line.net),
      ]),
      l.emptyProducts,
    );
    y -= 20;
    ensure(110);
    text(`${l.net}: ${formatMoney(data.net)}`, 12);
    text(`${l.vat}: ${formatMoney(data.vat)}`, 12);
    text(`${l.gross}: ${formatMoney(data.gross)}`, 16);
  } else if (data.type === "brand-summary") {
    const l = data.labels;
    text(data.period);
    text(l.definition, 10, 16);
    text(`${l.orders}: ${data.report.order_count}`, 12);
    text(`${l.net}: ${formatMoney(BigInt(data.report.net_cents))}`, 12);
    text(`${l.vat}: ${formatMoney(BigInt(data.report.vat_cents))}`, 12);
    text(`${l.gross}: ${formatMoney(BigInt(data.report.gross_cents))}`, 16, 20);
    const widths = [68, 248, 48, contentWidth - 364];
    const headings = [l.season, l.customer, l.orders, l.net];
    table(
      widths,
      headings,
      data.report.rows.map((group) => [
        group.season_code,
        [group.customer, group.city].filter(Boolean).join(" · "),
        String(group.order_count),
        formatMoney(BigInt(group.net_cents)),
      ]),
      l.empty,
    );
  } else {
    const l = data.labels;
    if (!data.products.length) text(l.emptyProducts);
    for (const product of data.products) {
      ensure(110);
      text(product.name, 15);
      text(`${l.sku}: ${product.sku}`);
      if (product.description) text(product.description);
      text(
        `${l.unit_price_cents}: ${formatMoney(product.price)}   ${l.retail}: ${formatMoney(product.retail)}   ${l.vat_rate}: ${new Intl.NumberFormat("it-IT").format(product.vat)}%`,
      );
      text(`${l.variants}: ${product.variants.join("; ")}`, 10, 22);
    }
  }
  const pages = doc.getPages();
  pages.forEach((current, index) => {
    const label = `${data.labels.page} ${index + 1} / ${pages.length}`;
    current.drawText(label, {
      x: pageWidth - margin - font.widthOfTextAtSize(label, 9),
      y: margin - 10,
      size: 9,
      font,
      color: muted,
    });
  });
  return doc.save();
}
