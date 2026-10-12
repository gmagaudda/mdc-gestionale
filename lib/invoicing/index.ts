import "server-only";
import { createClient } from "@/lib/supabase/server";
import { MockInvoicingProvider } from "./mock";
import { SupabaseMockInvoiceStore } from "./supabase-store";
import { InvoicingError } from "./types";
import { FattureInCloudProvider } from "./fic/provider";
import { FicHttpClient } from "./fic/http";
import { readFicCompanies } from "./fic/config";
import { SupabaseFicInvoiceStore } from "./fic/supabase-store";
export function ficWebhookOptions() {
  return {
    audience: new URL(
      "/api/webhooks/invoicing",
      process.env.APP_URL,
    ).toString(),
    applicationId: process.env.FIC_APPLICATION_ID ?? "",
  };
}
export function invoicingProviderName(): "mock" | "fic" {
  const name = process.env.INVOICING_PROVIDER ?? "mock";
  if (name !== "mock" && name !== "fic")
    throw new InvoicingError("unavailable");
  return name;
}
export async function createInvoicingProvider(name = invoicingProviderName()) {
  if (name === "fic" && invoicingProviderName() !== "fic")
    throw new InvoicingError("unavailable");
  if (name === "fic")
    return new FattureInCloudProvider(
      new FicHttpClient(process.env.FIC_ACCESS_TOKEN ?? ""),
      new SupabaseFicInvoiceStore(await createClient()),
      readFicCompanies(process.env.FIC_COMPANIES_JSON),
      ficWebhookOptions(),
    );
  return new MockInvoicingProvider(
    new SupabaseMockInvoiceStore(await createClient()),
    { webhookSecret: process.env.INVOICING_WEBHOOK_SECRET ?? "", delayMs: 250 },
  );
}
