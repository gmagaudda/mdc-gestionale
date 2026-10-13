import { z } from "zod";
import { MAX_CENTS } from "@/lib/money";

export const seasonCode = z.string().regex(/^(SS|FW)([0-9]{2}|20[0-9]{2})$/);
export const historicalSourceSchema = z
  .object({
    batch_id: z.uuid(),
    brand: z.string().trim().min(1).max(200),
    customer: z.string().trim().min(1).max(200),
    city: z.string().max(200),
    country: z.string().max(200),
  })
  .strict();
export const profiles = [
  "auto",
  "continuous",
  "summer",
  "winter",
  "irregular",
] as const;
export const recommendationSettingsSchema = z
  .object({
    brand_id: z.uuid(),
    customer_id: z.uuid(),
    season_id: z.uuid(),
    weights: z.tuple([
      z.number().int().min(1).max(1000),
      z.number().int().min(1).max(1000),
      z.number().int().min(1).max(1000),
    ]),
    growth_bps: z.number().int().min(-10000).max(10000),
    seasonal_threshold: z.number().int().min(1).max(50),
    profile: z.enum(profiles),
    profile_reason: z.string().trim().max(500),
    historical_source: historicalSourceSchema.nullable(),
    overrides: z
      .array(
        z
          .object({
            code: z.string().regex(/^(SS|FW)[0-9]{2}$/),
            source: z.enum(["auto", "operational", "historical"]),
            state: z.enum(["default", "closed", "zero", "missing", "excluded"]),
            reason: z.string().trim().max(500),
          })
          .strict(),
      )
      .max(12),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.profile !== "auto" && !v.profile_reason)
      ctx.addIssue({
        code: "custom",
        path: ["profile_reason"],
        message: "reasonRequired",
      });
    if (new Set(v.overrides.map((r) => r.code)).size !== v.overrides.length)
      ctx.addIssue({
        code: "custom",
        path: ["overrides"],
        message: "validation",
      });
    for (const [i, r] of v.overrides.entries())
      if (["closed", "zero", "excluded"].includes(r.state) && !r.reason)
        ctx.addIssue({
          code: "custom",
          path: ["overrides", i, "reason"],
          message: "reasonRequired",
        });
  });
export type RecommendationSettings = z.infer<
  typeof recommendationSettingsSchema
>;
const cents = z.string().regex(/^\d{1,18}$/);
export const recommendationSchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{32}$/),
  target: seasonCode,
  suggested_cents: z.number().int().min(0).max(MAX_CENTS).nullable(),
  base_cents: cents.nullable(),
  detected_profile: z.enum([
    "continuous",
    "summer",
    "winter",
    "irregular",
    "insufficient",
  ]),
  profile: z.enum([
    "continuous",
    "summer",
    "winter",
    "irregular",
    "insufficient",
  ]),
  paired_cycles: z.number().int().min(0),
  history_count: z.number().int().min(0).max(3),
  historical_match: z.enum(["none", "automatic", "explicit", "ambiguous"]),
  historical_source: historicalSourceSchema.nullable(),
  rows: z
    .array(
      z.object({
        code: z.string().regex(/^(SS|FW)[0-9]{2}$/),
        kind: z.enum(["SS", "FW"]),
        year: z.number().int(),
        state: z.enum(["known", "missing", "open", "conflict", "excluded"]),
        source: z.enum(["operational", "historical", "declared", "none"]),
        amount_cents: cents.nullable(),
        operational_cents: cents.nullable(),
        historical_cents: cents.nullable(),
        closed: z.boolean(),
        used: z.boolean(),
        weight: z.number().int().min(0),
        reason: z.string(),
      }),
    )
    .max(12),
});
export type BudgetRecommendation = z.infer<typeof recommendationSchema>;
export const recommendationProvenanceSchema = z
  .object({
    snapshot: recommendationSchema,
    settings: recommendationSettingsSchema,
    applied_cents: z.number().int().min(0).max(MAX_CENTS),
    adjustment_reason: z.string(),
    created_at: z.string(),
  })
  .nullable();
