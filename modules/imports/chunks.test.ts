import { it, expect } from "vitest";
import { importChunks } from "./chunks";
it("bounds both row count and UTF-8 request bytes without losing physical rows", () => {
  const rows = Array.from({ length: 1300 }, (_, i) => ({
    number: i + 2,
    values: ["è".repeat(2000)],
  }));
  const chunks = importChunks(rows);
  expect(chunks.flat()).toEqual(rows);
  expect(
    chunks.every(
      (c) =>
        c.length <= 500 &&
        new TextEncoder().encode(JSON.stringify(c)).length <= 650000,
    ),
  ).toBe(true);
  expect(
    importChunks(
      Array.from({ length: 501 }, (_, i) => ({ number: i + 2, values: [1] })),
    ).map((c) => c.length),
  ).toEqual([500, 1]);
});
it("rejects a single oversized row rather than sending a doomed request", () => {
  expect(() =>
    importChunks([{ number: 2, values: ["a".repeat(650001)] }]),
  ).toThrow("rowSize");
});
