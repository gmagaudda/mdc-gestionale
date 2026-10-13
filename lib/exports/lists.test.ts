import { expect, test } from "vitest";
import { listExports, listExportFiltersSchema } from "./lists";
import messages from "@/messages/it.json";
test("export column labels exist and financial filters reject invalid values", () => {
  const text = messages as unknown as Record<string, Record<string, unknown>>;
  for (const config of Object.values(listExports)) {
    for (const column of config.columns)
      expect(typeof text[config.namespace][column.label]).toBe("string");
    expect(config.sort).toContain(config.defaultSort);
  }
  expect(
    listExportFiltersSchema.safeParse({ q: "x".repeat(101) }).success,
  ).toBe(false);
  expect(
    listExportFiltersSchema.safeParse({ status: "rejected", overdue: "yes" })
      .success,
  ).toBe(true);
  expect(listExportFiltersSchema.safeParse({ status: "queued" }).success).toBe(
    false,
  );
  expect(
    listExportFiltersSchema.safeParse({ direction: "asc; drop table" }).success,
  ).toBe(false);
});
