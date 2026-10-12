import { z } from "zod";
import { calculateLine } from "@/lib/money";
import {
  canonicalFields,
  type MappingProfile,
  type ImportEntity,
} from "./fields";
import {
  normalizeCents,
  normalizeDate,
  normalizePercentage,
  normalizeQuantity,
  normalizeText,
  matchKey,
  validTaxCode,
  validVatNumber,
} from "./normalize";
import type { ParsedSheet, ImportCell } from "./parser";
export type ImportMessage = {
  field: string;
  code:
    | "required"
    | "invalidValue"
    | "invalidPeriod"
    | "duplicate"
    | "inconsistentOrder"
    | "amountMismatch"
    | "unmappedRow"
    | "budgetOverlap";
  severity: "error" | "warning";
};
export type NormalizedImportRow = {
  entity: ImportEntity;
  sheet: string;
  row_number: number;
  raw: Record<string, ImportCell>;
  mapped: Record<string, string | number>;
  status: "valid" | "warning" | "error" | "skipped";
  messages: ImportMessage[];
};
export function normalizeMappedSheet(
  sheet: ParsedSheet,
  profile: MappingProfile,
): NormalizedImportRow[] {
  if (sheet.name !== profile.sheet_name) throw Error("sheetMismatch");
  const rows: NormalizedImportRow[] = [],
    keys = new Map<string, NormalizedImportRow>(),
    orders = new Map<
      string,
      { signature: string; rows: NormalizedImportRow[] }
    >();
  for (const source of sheet.rows.filter(
    (r) => r.number > profile.header_row,
  )) {
    const row: NormalizedImportRow = {
      entity: profile.entity,
      sheet: sheet.name,
      row_number: source.number,
      raw: Object.fromEntries(source.values.map((v, i) => [`c${i}`, v])),
      mapped: {},
      status: "valid",
      messages: [],
    };
    const issue = (
      field: string,
      code: ImportMessage["code"],
      severity: ImportMessage["severity"] = "error",
    ) => row.messages.push({ field, code, severity });
    let hasValue = false;
    for (const field of canonicalFields[profile.entity]) {
      const column = profile.mapping[field.key],
        hasColumn = column !== null && column !== undefined;
      const value = hasColumn
        ? source.values[column]
        : profile.options.defaults[field.key];
      const text = normalizeText(value);
      const populated =
        value !== undefined &&
        value !== null &&
        (text !== "" ||
          typeof value === "object" ||
          typeof value === "boolean");
      hasValue ||= populated;
      if (!populated) {
        if (field.required) issue(field.key, "required");
        if (hasColumn) row.mapped[field.key] = "";
        continue;
      }
      let normalized: string | number | null = text;
      switch (field.type) {
        case "money":
          normalized = normalizeCents(value, profile.options.numberFormat);
          break;
        case "date":
          normalized = normalizeDate(value, profile.options.dateFormat);
          break;
        case "quantity":
          normalized = normalizeQuantity(value);
          if (normalized !== null && normalized > 100000) normalized = null;
          break;
        case "percentage":
          normalized = normalizePercentage(
            value,
            profile.options.numberFormat,
            field.key === "vat_rate"
              ? "percent"
              : profile.options.percentageScale,
          );
          break;
        case "email":
          normalized = z.email().safeParse(text).success ? text : null;
          break;
        case "vat":
          normalized = validVatNumber(text) ? text : null;
          break;
        case "taxCode":
          normalized = validTaxCode(text) ? text.toUpperCase() : null;
          break;
        default:
          if (
            typeof value === "object" ||
            typeof value === "boolean" ||
            text.length >
              ({
                notes: 5000,
                season: 30,
                sku: 80,
                color: 80,
                size: 40,
                postal_code: 20,
                province: 10,
                phone: 40,
              }[field.key] ?? 200)
          )
            normalized = null;
      }
      if (normalized === null || (field.required && normalized === ""))
        issue(field.key, "invalidValue");
      else
        row.mapped[field.key] = ["country", "sdi_code"].includes(field.key)
          ? String(normalized).toUpperCase()
          : normalized;
    }
    if (!hasValue) {
      row.messages = [{ field: "", code: "unmappedRow", severity: "warning" }];
      row.status = "skipped";
      rows.push(row);
      continue;
    }
    const value = (key: string) => row.mapped[key];
    if (
      profile.entity === "customers" &&
      value("country") &&
      !/^[A-Z]{2}$/.test(String(value("country")))
    )
      issue("country", "invalidValue");
    if (
      profile.entity === "customers" &&
      value("sdi_code") &&
      !/^[A-Z0-9]{7}$/.test(String(value("sdi_code")))
    )
      issue("sdi_code", "invalidValue");
    if (
      profile.entity === "budgets" &&
      typeof value("period_start") === "string" &&
      typeof value("period_end") === "string" &&
      value("period_end") < value("period_start")
    )
      issue("period_end", "invalidPeriod");
    if (profile.entity === "orders") {
      const required =
        profile.options.granularity === "order_lines"
          ? ["sku", "quantity", "unit_price_cents"]
          : ["total_cents", "vat_rate", "product_name"];
      for (const key of required)
        if (value(key) === undefined || value(key) === "")
          issue(key, "required");
      if (
        profile.options.granularity === "order_totals" &&
        (Number(value("discount_pct") || 0) !== 0 ||
          Number(value("line_discount_pct") || 0) !== 0)
      )
        issue(
          Number(value("discount_pct") || 0) !== 0
            ? "discount_pct"
            : "line_discount_pct",
          "invalidValue",
        );
      if (
        value("status") !== undefined &&
        !["draft", "confirmed", ""].includes(String(value("status")))
      )
        issue("status", "invalidValue");
      if (
        value("delivery_date") &&
        value("order_date") &&
        value("delivery_date") < value("order_date")
      )
        issue("delivery_date", "invalidPeriod");
      if (
        typeof value("quantity") === "number" &&
        typeof value("unit_price_cents") === "number" &&
        typeof value("line_net_cents") === "number"
      ) {
        const line = calculateLine({
          quantity: Number(value("quantity")),
          unitPriceCents: Number(value("unit_price_cents")),
          lineDiscount: Number(value("line_discount_pct") || 0),
          orderDiscount: Number(value("discount_pct") || 0),
          vatRate: 0,
        });
        const diff = line.net - BigInt(value("line_net_cents"));
        if (diff > 1n || diff < -1n)
          issue("line_net_cents", "amountMismatch", "warning");
      }
    }
    let key = "";
    if (profile.entity === "customers")
      key = value("external_code")
        ? `code:${value("external_code")}`
        : value("vat_number")
          ? `vat:${value("vat_number")}`
          : `name:${JSON.stringify([matchKey(value("legal_name")), matchKey(value("city")), matchKey(value("country"))])}`;
    if (profile.entity === "budgets")
      key = JSON.stringify([
        value("brand"),
        value("season"),
        value("customer"),
        value("period_start"),
        value("period_end"),
      ]);
    if (profile.entity === "orders") {
      const orderKey = JSON.stringify([
        matchKey(value("brand")),
        value("external_ref") || [
          value("customer"),
          value("season"),
          value("order_date"),
        ],
      ]);
      const signature = JSON.stringify([
        value("customer"),
        value("season"),
        value("order_date"),
        value("delivery_date"),
        value("discount_pct"),
        value("status"),
      ]);
      const prior = orders.get(orderKey);
      if (prior && prior.signature !== signature) {
        issue("external_ref", "inconsistentOrder");
        for (const member of prior.rows) {
          member.messages.push({
            field: "external_ref",
            code: "inconsistentOrder",
            severity: "error",
          });
          member.status = "error";
        }
      }
      if (prior) prior.rows.push(row);
      else orders.set(orderKey, { signature, rows: [row] });
      key =
        profile.options.granularity === "order_lines"
          ? JSON.stringify([orderKey, value("sku")])
          : orderKey;
    }
    if (key && keys.has(key)) {
      issue("", "duplicate");
      const previous = keys.get(key)!;
      previous.messages.push({
        field: "",
        code: "duplicate",
        severity: "error",
      });
      previous.status = "error";
    } else if (key) keys.set(key, row);
    row.status = row.messages.some((m) => m.severity === "error")
      ? "error"
      : row.messages.length
        ? "warning"
        : "valid";
    rows.push(row);
  }
  if (profile.entity === "budgets") {
    const scopes = new Map<string, NormalizedImportRow[]>();
    for (const row of rows.filter(
      (r) => r.status !== "error" && r.status !== "skipped",
    )) {
      const key = JSON.stringify([
          matchKey(row.mapped.brand),
          matchKey(row.mapped.season),
          matchKey(row.mapped.customer),
        ]),
        group = scopes.get(key) ?? [];
      group.push(row);
      scopes.set(key, group);
    }
    for (const group of scopes.values()) {
      group.sort((a, b) =>
        String(a.mapped.period_start).localeCompare(
          String(b.mapped.period_start),
        ),
      );
      let farthest = group[0];
      for (const row of group.slice(1)) {
        if (row.mapped.period_start <= farthest.mapped.period_end)
          for (const member of [row, farthest]) {
            member.status = "error";
            member.messages.push({
              field: "period_start",
              code: "budgetOverlap",
              severity: "error",
            });
          }
        if (row.mapped.period_end > farthest.mapped.period_end) farthest = row;
      }
    }
  }
  return rows;
}
