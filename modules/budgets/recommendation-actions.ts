"use server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/errors";
import type { Choice } from "@/components/shared/search-select";
import {
  historicalSourceSchema,
  recommendationSchema,
  recommendationSettingsSchema,
  type BudgetRecommendation,
} from "./recommendation-schema";

export async function calculateBudgetRecommendation(
  input: unknown,
): Promise<ActionResult<BudgetRecommendation>> {
  await requireRole(["admin", "accounting"]);
  const parsed = recommendationSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  const result = await (
    await createClient()
  ).rpc("calculate_budget_recommendation", { p_settings: parsed.data });
  const snapshot = recommendationSchema.safeParse(result.data);
  if (result.error || !snapshot.success)
    return {
      ok: false,
      error:
        result.error?.message === "SEASON_CODE"
          ? "seasonCode"
          : result.error?.message === "SEASON_OPEN"
            ? "seasonOpen"
            : result.error?.message === "ZERO_CONFLICT"
              ? "zeroConflict"
              : result.error?.message === "AMOUNT_LIMIT"
                ? "amountLimit"
                : "calculateError",
    };
  return { ok: true, data: snapshot.data };
}

export async function searchHistoricalBudgetSources(
  input: unknown,
): Promise<ActionResult<Choice[]>> {
  await requireRole(["admin", "accounting"]);
  const term = z.string().trim().max(100).safeParse(input);
  if (!term.success) return { ok: false, error: "validation" };
  const result = await (
    await createClient()
  ).rpc("budget_history_sources", { p_q: term.data });
  const rows = z
    .array(
      historicalSourceSchema.extend({
        file_name: z.string(),
        completed_at: z.string().nullable(),
      }),
    )
    .safeParse(result.data);
  if (result.error || !rows.success) return { ok: false, error: "loadError" };
  return {
    ok: true,
    data: rows.data.map((row) => {
      const { batch_id, brand, customer, city, country } = row;
      const source = { batch_id, brand, customer, city, country };
      return {
        value: JSON.stringify(source),
        label: [
          source.brand,
          source.customer,
          source.city,
          source.country,
          row.file_name,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    }),
  };
}
