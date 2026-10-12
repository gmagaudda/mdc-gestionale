import { it, expect } from "vitest";
import {
  validateDocumentFile,
  maxDocumentSize,
  documentSchema,
} from "./schema";
it("checks MIME, extension and file signature together", () => {
  const pdf = new TextEncoder().encode("%PDF-1.4\n");
  expect(validateDocumentFile("catalog.PDF", "application/pdf", pdf).ok).toBe(
    true,
  );
  expect(
    validateDocumentFile(
      "catalog.pdf",
      "application/pdf",
      new TextEncoder().encode("<html>unsafe</html>"),
    ).ok,
  ).toBe(false);
  expect(validateDocumentFile("catalog.html", "application/pdf", pdf).ok).toBe(
    false,
  );
  expect(validateDocumentFile("catalog.pdf", "text/html", pdf).ok).toBe(false);
  expect(
    validateDocumentFile(
      "image.jpeg",
      "image/jpeg",
      new Uint8Array([255, 216, 255, 224]),
    ).ok,
  ).toBe(true);
  expect(
    validateDocumentFile(
      "image.png",
      "image/png",
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    ).ok,
  ).toBe(true);
});
it("refuses empty, oversize and invalid filename documents", () => {
  expect(
    validateDocumentFile("a.pdf", "application/pdf", new Uint8Array()).error,
  ).toBe("size");
  expect(
    validateDocumentFile(
      "a.pdf",
      "application/pdf",
      new Uint8Array(maxDocumentSize + 1),
    ).error,
  ).toBe("size");
  expect(
    validateDocumentFile(
      "a\r\nb.pdf",
      "application/pdf",
      new Uint8Array([37, 80, 68, 70, 45]),
    ).error,
  ).toBe("filename");
});
it("validates document associations and sharing input", () => {
  expect(
    documentSchema.safeParse({
      name: "Catalogo",
      kind: "catalog",
      brand_id: "not-an-id",
      shared_with_brand: true,
    }).success,
  ).toBe(false);
  expect(
    documentSchema.safeParse({
      name: "Catalogo",
      kind: "catalog",
      brand_id: "00000000-0000-4000-8000-000000000001",
      shared_with_brand: true,
    }).success,
  ).toBe(true);
});
