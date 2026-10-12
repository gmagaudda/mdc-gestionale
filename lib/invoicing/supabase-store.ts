import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  externalStatusSchema,
  InvoicingError,
  type ExternalStatus,
} from "./types";
import type { MockInvoiceStore, MockInvoiceRecord } from "./mock";
const recordSchema = z.strictObject({
  externalId: z.string().min(1),
  idempotencyKey: z.uuid(),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  status: externalStatusSchema,
});
function fail(code: string): never {
  throw new InvoicingError(
    code === "P0002"
      ? "not_found"
      : code === "23505"
        ? "conflict"
        : code === "23514"
          ? "invalid_transition"
          : "unavailable",
    code !== "P0002" && code !== "23505" && code !== "23514",
  );
}
export class SupabaseMockInvoiceStore implements MockInvoiceStore {
  constructor(private readonly db: SupabaseClient<Database>) {}
  async putIfAbsent(record: MockInvoiceRecord) {
    const id = record.externalId.replace(/^mock_/, "");
    if (!z.uuid().safeParse(id).success)
      throw new InvoicingError("invalid_input");
    const { data, error } = await this.db.rpc("mock_invoice_put", {
      p_id: id,
      p_key: record.idempotencyKey,
      p_fingerprint: record.fingerprint,
      p_status: record.status,
    });
    if (error) fail(error.code);
    return recordSchema.parse(data);
  }
  async get(externalId: string) {
    const { data, error } = await this.db
      .from("mock_invoice_records")
      .select("external_id,idempotency_key,fingerprint,status")
      .eq("external_id", externalId)
      .maybeSingle();
    if (error) fail(error.code);
    return data
      ? recordSchema.parse({
          externalId: data.external_id,
          idempotencyKey: data.idempotency_key,
          fingerprint: data.fingerprint,
          status: data.status,
        })
      : null;
  }
  async transition(externalId: string, status: ExternalStatus) {
    const { data, error } = await this.db.rpc("mock_invoice_transition", {
      p_external_id: externalId,
      p_status: status,
    });
    if (error) fail(error.code);
    return recordSchema.parse(data);
  }
}
