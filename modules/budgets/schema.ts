import { z } from "zod";
import { MAX_CENTS } from "@/lib/money";
const optionalId = z.uuid().or(z.literal(""));
export const budgetSchema = z
  .object({
    brand_id: z.uuid(),
    season_id: optionalId,
    customer_id: optionalId,
    amount_cents: z.number().int().min(0).max(MAX_CENTS),
    period_start: z.iso.date(),
    period_end: z.iso.date(),
    notes: z.string().trim().max(5000),
  })
  .refine((value) => value.period_end >= value.period_start, {
    path: ["period_end"],
    message: "dateRange",
  });
export type BudgetInput = z.infer<typeof budgetSchema>;
