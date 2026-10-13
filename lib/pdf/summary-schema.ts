import { z } from "zod";
const cents = z.string().regex(/^\d+$/);
export const brandSummarySchema = z
  .object({
    count: z.number().int().nonnegative(),
    order_count: z.number().int().nonnegative(),
    net_cents: cents,
    vat_cents: cents,
    gross_cents: cents,
    rows: z
      .array(
        z
          .object({
            season_code: z.string(),
            customer: z.string().nullable(),
            city: z.string().nullable(),
            order_count: z.number().int().nonnegative(),
            net_cents: cents,
            vat_cents: cents,
            gross_cents: cents,
          })
          .strict(),
      )
      .max(1000),
  })
  .strict();
export class PdfSummaryTooLarge extends Error {}
