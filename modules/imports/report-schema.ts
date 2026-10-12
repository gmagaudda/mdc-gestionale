import { z } from "zod";
import { performanceMetrics, type PerformanceMetric } from "./performance";
const cents = z.string().regex(/^\d+$/).nullable();
const metrics = Object.fromEntries(
  performanceMetrics.map((m) => [m.key, cents]),
) as Record<PerformanceMetric, typeof cents>;
export const performanceReportSchema = z.object({
  batch_id: z.uuid(),
  file_name: z.string(),
  created_at: z.string(),
  pivotBrands: z.array(z.string()),
  expected: z.record(z.string(), z.number().nullable()),
  groups: z.array(
    z.object({
      label: z.string(),
      rows: z.number().int(),
      customers: z.number().int(),
      ...metrics,
    }),
  ),
  group_count: z.number().int(),
  totals: z.object({
    rows: z.number().int(),
    unnamed_rows: z.number().int(),
    ...metrics,
  }),
  choices: z.object({
    brands: z.array(z.string()),
    areas: z.array(z.string()),
    representatives: z.array(z.string()),
    countries: z.array(z.string()),
    regions: z.array(z.string()),
  }),
});
export type PerformanceReport = z.infer<typeof performanceReportSchema>;
export const performanceFilterSchema = z.object({
  batch: z.uuid(),
  dimension: z
    .enum(["brand", "area", "representative", "country", "region", "customer"])
    .default("brand"),
  scope: z.enum(["pivot", "all"]).default("pivot"),
  brand: z.string().max(200).default(""),
  area: z.string().max(200).default(""),
  representative: z.string().max(200).default(""),
  country: z.string().max(200).default(""),
  region: z.string().max(200).default(""),
  search: z.string().max(100).default(""),
  page: z.coerce.number().int().min(1).max(200).default(1),
});
export type PerformanceFilters = z.infer<typeof performanceFilterSchema>;
