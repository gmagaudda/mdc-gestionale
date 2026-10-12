import "server-only";
import { createClient } from "@/lib/supabase/server";
import { MockInvoicingProvider } from "./mock";
import { SupabaseMockInvoiceStore } from "./supabase-store";
import { InvoicingError } from "./types";
export function invoicingProviderName(): "mock" | "fic" {
  const name = process.env.INVOICING_PROVIDER ?? "mock";
  if (name !== "mock" && name !== "fic")
    throw new InvoicingError("unavailable");
  return name;
}
export async function createInvoicingProvider(name = invoicingProviderName()) {
  if (name !== "mock") throw new InvoicingError("unavailable");
  return new MockInvoicingProvider(
    new SupabaseMockInvoiceStore(await createClient()),
    { webhookSecret: process.env.INVOICING_WEBHOOK_SECRET ?? "", delayMs: 250 },
  );
}
