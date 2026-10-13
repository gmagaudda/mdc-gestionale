import { describe, expect, it } from "vitest";
import {
  aggregatePerformance,
  readPerformanceWorkbook,
  sumPerformance,
  performanceMetrics,
  comparePerformance,
  type PerformanceRow,
} from "./performance";
import type { ParsedWorkbook } from "./parser";
const values = Object.fromEntries(
  performanceMetrics.map((m) => [m.key, null]),
) as PerformanceRow["values"];
const row = (override: Partial<PerformanceRow> = {}): PerformanceRow => ({
  row_number: 3,
  brand: "Brand A",
  customer: "Negozio",
  representative: "Agente",
  area: "EUROPE",
  country: "IT",
  region: "Lombardia",
  city: "Milano",
  customer_status: "Attivo",
  values: { ...values },
  ...override,
});
describe("historical totals keep their original perimeter", () => {
  it("recomputes the percentage on aggregate amounts and handles null or zero budgets", () => {
    expect(comparePerformance("19050", "23000")).toEqual({
      amount: -3950n,
      percent: -1717n,
    });
    expect(comparePerformance("0", "0")).toEqual({ amount: 0n, percent: null });
    expect(comparePerformance(null, "0")).toEqual({
      amount: null,
      percent: null,
    });
  });
  it("preserves unnamed rows and distinguishes missing amounts from zero", () => {
    const rows = [
      row({ customer: "", values: { ...values, orders_fw26: 12025 } }),
      row({ values: { ...values, orders_fw26: 0 } }),
    ];
    expect(sumPerformance(rows)).toMatchObject({
      orders_fw26: "12025",
      budget_fw26: null,
    });
    expect(aggregatePerformance(rows)[0]).toMatchObject({
      rows: 2,
      customers: 1,
      values: { orders_fw26: "12025", budget_fw26: null },
    });
  });
  it("does not merge distinct original labels or collide customer tuples", () => {
    const rows = [
      row({ brand: "A/B", customer: "A/B", city: "C" }),
      row({ brand: "AB", customer: "A", city: "B/C" }),
    ];
    expect(aggregatePerformance(rows)).toHaveLength(2);
    expect(
      aggregatePerformance(rows.map((r) => ({ ...r, brand: "Same brand" })))[0]
        .customers,
    ).toBe(2);
  });
  it("adds integer cents beyond safe numeric aggregate range", () => {
    const rows = Array.from({ length: 10000 }, () =>
      row({ values: { ...values, orders_ss27: 1000000000000 } }),
    );
    expect(sumPerformance(rows).orders_ss27).toBe("10000000000000000");
  });
});
describe("RECAP and saved pivot values", () => {
  const workbook = (): ParsedWorkbook => ({
    rowCount: 5,
    durationMs: 1,
    sheets: [
      {
        name: "RECAP BUDGET ",
        rows: [
          {
            number: 2,
            values: [
              "BRAND",
              "CLIENTI",
              ...performanceMetrics.map((m) => m.header),
            ],
          },
          { number: 3, values: ["Brand A", "", 100, 200, 150, 300, 250] },
          {
            number: 4,
            values: ["Brand escluso", "Negozio", 999, 900, 800, 700, 600],
          },
        ],
      },
      {
        name: "Analisi Pivot",
        rows: [
          {
            number: 5,
            values: [
              "Etichette di riga",
              ...performanceMetrics.map((m) => `Somma di ${m.header}`),
            ],
          },
          { number: 6, values: ["Brand A", 100, 200, 150, 300, 250] },
          {
            number: 7,
            values: ["Totale complessivo", 100, 200, 150, 300, 250],
          },
        ],
      },
    ],
  });
  it("keeps all records but compares only the brands selected in the pivot", () => {
    const data = readPerformanceWorkbook(workbook());
    expect(data.rows).toHaveLength(2);
    expect(data.pivotBrands).toEqual(["Brand A"]);
    expect(data.issues).toEqual([
      {
        row: 3,
        column: "CLIENTI",
        code: "missingIdentity",
        severity: "warning",
      },
    ]);
    expect(data.expected.orders_ss26).toBe(10000);
    expect(sumPerformance(data.rows).orders_ss26).toBe("109900");
    expect(
      sumPerformance(
        data.rows.filter((r) => data.pivotBrands.includes(r.brand)),
      ).orders_ss26,
    ).toBe("10000");
  });
  it("rejects text and formula errors in monetary cells", () => {
    const book = workbook();
    book.sheets[0].rows[1].values[2] = { error: "#VALUE!" };
    book.sheets[0].rows[2].values[2] = "testo";
    const data = readPerformanceWorkbook(book);
    expect(data.issues.filter((i) => i.code === "invalidMoney")).toHaveLength(
      2,
    );
    expect(data.rows.every((r) => r.values.orders_ss26 === null)).toBe(true);
  });
  it("does not invent a brand when its identity is absent", () => {
    const book = workbook();
    book.sheets[0].rows[2].values[0] = null;
    const data = readPerformanceWorkbook(book);
    expect(data.rows).toHaveLength(1);
    expect(data.issues).toContainEqual({
      row: 4,
      column: "BRAND",
      code: "missingIdentity",
      severity: "error",
    });
  });
});
