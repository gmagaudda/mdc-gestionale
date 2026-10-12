import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { FattureInCloudProvider } from "./provider";
import { SupabaseFicInvoiceStore } from "./supabase-store";
import { FicHttpClient } from "./http";
import { readFicCompanies } from "./config";
const claimsSchema = z
  .array(
    z.object({ id: z.uuid(), lease: z.uuid(), external_id: z.string().min(1) }),
  )
  .max(10);
export async function processFicWebhooks(db: SupabaseClient<Database>) {
  const provider = new FattureInCloudProvider(
    new FicHttpClient(process.env.FIC_ACCESS_TOKEN ?? ""),
    new SupabaseFicInvoiceStore(db),
    readFicCompanies(process.env.FIC_COMPANIES_JSON),
    { audience: "", applicationId: "" },
  );
  const claim = await db.rpc("claim_fic_webhooks");
  if (claim.error) throw Error("Claim unavailable");
  const entries = claimsSchema.parse(claim.data);
  let completed = 0,
    failed = 0;
  // Bounded concurrency; failures remain in SQL for the next scheduled attempt.
  for (let offset = 0; offset < entries.length; offset += 3) {
    await Promise.all(
      entries.slice(offset, offset + 3).map(async (entry) => {
        try {
          const status = await provider.getStatus(entry.external_id);
          const result = await db.rpc("finish_fic_webhook", {
            p_id: entry.id,
            p_lease: entry.lease,
            p_status: status,
          });
          if (result.error || !result.data)
            throw Error("Completion unavailable");
          completed++;
        } catch {
          await db.rpc("fail_fic_webhook", {
            p_id: entry.id,
            p_lease: entry.lease,
          });
          failed++;
        }
      }),
    );
  }
  return { completed, failed };
}
