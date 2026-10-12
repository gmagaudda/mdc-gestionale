import { z } from "zod";
const money = z
  .string()
  .regex(/^\d+(?:\.0+)?$/)
  .transform((v) => v.split(".")[0]);
export const operationalPreviewSchema = z.object({
  operations: z.array(
    z.object({
      row_id: z.uuid(),
      sheet: z.string(),
      row: z.number().int(),
      entity: z.enum(["customers", "orders", "budgets"]),
      action: z.enum(["create", "update", "skip"]),
      target_id: z.uuid().nullable(),
      changes: z.array(
        z.object({
          field: z.string(),
          before: z.union([z.string(), z.number(), z.null()]),
          after: z.union([z.string(), z.number(), z.null()]),
        }),
      ),
    }),
  ),
  total: z.number().int().min(0),
  page: z.number().int().min(1),
  problems: z.array(
    z.object({
      sheet: z.string(),
      row: z.number().int(),
      code: z.enum([
        "invalidRow",
        "missingMatch",
        "newArticleData",
        "existingOrderLocked",
      ]),
    }),
  ),
  problem_count: z.number().int().min(0),
  errors: z.number().int().min(0),
  totals: z.array(
    z.object({
      brand: z.string(),
      season: z.string(),
      orders: z.number().int(),
      customers: z.number().int(),
      pieces: z.number().int(),
      net_cents: money,
      gross_cents: money.nullable(),
    }),
  ),
  expected: z.record(z.string(), z.string().regex(/^\d{1,17}$/)),
  complete: z.boolean().nullable(),
});
export type OperationalPreview = z.infer<typeof operationalPreviewSchema>;
