import { z } from "zod";
import { roundRatio } from "@/lib/money";
import type { ParsedWorkbook, ParsedSheet } from "./parser";
import { normalizeCents, normalizeText, matchKey } from "./normalize";
export const performanceMetrics = [
  { key: "orders_ss26", header: "ORDINE SS26", kind: "orders", season: "SS26" },
  { key: "budget_fw26", header: "BDG FW26", kind: "budgets", season: "FW26" },
  { key: "orders_fw26", header: "ORDINE FW26", kind: "orders", season: "FW26" },
  { key: "budget_ss27", header: "BDG SS27", kind: "budgets", season: "SS27" },
  { key: "orders_ss27", header: "ORDINE SS27", kind: "orders", season: "SS27" },
] as const;
export type PerformanceMetric = (typeof performanceMetrics)[number]["key"];
export const performanceRowSchema = z
  .object({
    row_number: z.number().int().min(1).max(1048576),
    brand: z.string().trim().min(1).max(200),
    customer: z.string().trim().max(200),
    representative: z.string().max(200),
    area: z.string().max(200),
    country: z.string().max(200),
    region: z.string().max(200),
    city: z.string().max(200),
    customer_status: z.string().max(200),
    values: z
      .object(
        Object.fromEntries(
          performanceMetrics.map((m) => [
            m.key,
            z.number().int().min(0).max(1000000000000).nullable(),
          ]),
        ) as Record<PerformanceMetric, z.ZodNullable<z.ZodNumber>>,
      )
      .strict(),
  })
  .strict();
export type PerformanceRow = z.infer<typeof performanceRowSchema>;
export function comparePerformance(
  actual: string | null,
  budget: string | null,
) {
  if (actual === null || budget === null)
    return { amount: null, percent: null };
  const value = BigInt(actual) - BigInt(budget),
    base = BigInt(budget);
  return {
    amount: value,
    percent:
      base === 0n
        ? null
        : (value < 0n ? -1n : 1n) *
          roundRatio((value < 0n ? -value : value) * 10000n, base),
  };
}
export function sumPerformance(rows: PerformanceRow[]) {
  return Object.fromEntries(
    performanceMetrics.map((m) => {
      let total: bigint | null = null;
      for (const row of rows) {
        const amount = row.values[m.key];
        if (amount !== null) total = (total ?? 0n) + BigInt(amount);
      }
      return [m.key, total?.toString() ?? null];
    }),
  ) as Record<PerformanceMetric, string | null>;
}
export type PerformanceDataset = {
  rows: PerformanceRow[];
  pivotBrands: string[];
  expected: Record<PerformanceMetric, number | null>;
  issues: {
    row: number;
    column: string;
    code: "missingIdentity" | "invalidMoney";
    severity: "warning" | "error";
  }[];
  sheet: string;
};
export function selectPivotRows(
  dataset: PerformanceDataset | null,
): PerformanceRow[] {
  if (!dataset) return [];
  return dataset.pivotBrands.length
    ? dataset.rows.filter((r) => dataset.pivotBrands.includes(r.brand))
    : dataset.rows;
}
export function readPerformanceWorkbook(
  workbook: ParsedWorkbook,
): PerformanceDataset {
  const source = workbook.sheets.find(
    (s) => matchKey(s.name) === matchKey("RECAP BUDGET"),
  );
  if (!source) throw Error("recapMissing");
  const header = source.rows.find(
    (r) =>
      r.values.some((v) => matchKey(v) === "brand") &&
      r.values.some((v) => matchKey(v) === "clienti"),
  );
  if (!header) throw Error("headerMissing");
  const column = (name: string) =>
    header.values.findIndex((v) => matchKey(v) === matchKey(name));
  for (const name of [
    "BRAND",
    "CLIENTI",
    ...performanceMetrics.map((m) => m.header),
  ])
    if (column(name) < 0) throw Error("columnsMissing");
  const rows: PerformanceRow[] = [],
    issues: PerformanceDataset["issues"] = [];
  for (const row of source.rows.filter((r) => r.number > header.number)) {
    const get = (name: string) => row.values[column(name)],
      brand = normalizeText(get("BRAND")),
      customer = normalizeText(get("CLIENTI"));
    if (
      !brand &&
      !customer &&
      performanceMetrics.every((m) => {
        const raw = get(m.header);
        return (
          raw === null ||
          raw === undefined ||
          (typeof raw === "string" && normalizeText(raw) === "")
        );
      })
    )
      continue;
    if (!brand || !customer) {
      issues.push({
        row: row.number,
        column: !brand ? "BRAND" : "CLIENTI",
        code: "missingIdentity",
        severity: !brand ? "error" : "warning",
      });
      if (!brand) continue;
    }
    const values = {} as Record<PerformanceMetric, number | null>;
    for (const m of performanceMetrics) {
      const raw = get(m.header),
        amount = normalizeCents(raw);
      if (
        raw !== null &&
        raw !== undefined &&
        (normalizeText(raw) !== "" ||
          typeof raw === "object" ||
          typeof raw === "boolean") &&
        amount === null
      )
        issues.push({
          row: row.number,
          column: m.header,
          code: "invalidMoney",
          severity: "error",
        });
      values[m.key] = amount;
    }
    const parsed = performanceRowSchema.safeParse({
      row_number: row.number,
      brand,
      customer,
      representative: normalizeText(get("Commerciale")),
      area: normalizeText(get("AREA")),
      country: normalizeText(get("STATO")),
      region: normalizeText(get("REGIONE")),
      city: normalizeText(get("CITTA")),
      customer_status: normalizeText(get("STATUS")),
      values,
    });
    if (!parsed.success) throw Error("validation");
    rows.push(parsed.data);
  }
  const pivot = workbook.sheets.find(
    (s) => matchKey(s.name) === matchKey("Analisi Pivot"),
  );
  const controls = readPivot(pivot);
  return { rows, issues, sheet: source.name, ...controls };
}
function readPivot(sheet?: ParsedSheet) {
  const expected = Object.fromEntries(
      performanceMetrics.map((m) => [m.key, null]),
    ) as Record<PerformanceMetric, number | null>,
    pivotBrands: string[] = [];
  const header = sheet?.rows.find((r) =>
    r.values.some((v) => matchKey(v) === "etichettediriga"),
  );
  if (!sheet || !header) return { expected, pivotBrands };
  for (const row of sheet.rows.filter((r) => r.number > header.number)) {
    const brand = normalizeText(row.values[0]);
    if (matchKey(brand) === "totalecomplessivo") {
      for (const m of performanceMetrics) {
        const i = header.values.findIndex(
          (v) => matchKey(v) === matchKey(`Somma di ${m.header}`),
        );
        if (i >= 0) expected[m.key] = normalizeCents(row.values[i]);
      }
      break;
    }
    if (brand) pivotBrands.push(brand);
  }
  return { expected, pivotBrands };
}
export function aggregatePerformance(rows: PerformanceRow[]) {
  const groups = new Map<
    string,
    {
      label: string;
      rows: number;
      customers: Set<string>;
      values: Record<PerformanceMetric, bigint | null>;
    }
  >();
  for (const row of rows) {
    const label = row.brand;
    if (!groups.has(label))
      groups.set(label, {
        label,
        rows: 0,
        customers: new Set(),
        values: Object.fromEntries(
          performanceMetrics.map((m) => [m.key, null]),
        ) as Record<PerformanceMetric, bigint | null>,
      });
    const group = groups.get(label)!;
    group.rows++;
    if (row.customer)
      group.customers.add(
        [row.customer, row.city, row.country]
          .map((v) => `${v.length}:${v}`)
          .join(""),
      );
    for (const m of performanceMetrics)
      if (row.values[m.key] !== null) {
        group.values[m.key] =
          (group.values[m.key] ?? 0n) + BigInt(row.values[m.key]!);
      }
  }
  return Array.from(groups.values())
    .map((g) => ({
      id: g.label,
      label: g.label,
      rows: g.rows,
      customers: g.customers.size,
      values: Object.fromEntries(
        performanceMetrics.map((m) => [
          m.key,
          g.values[m.key]?.toString() ?? null,
        ]),
      ) as Record<PerformanceMetric, string | null>,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "it"));
}
