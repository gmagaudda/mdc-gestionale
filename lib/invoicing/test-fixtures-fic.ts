// Synthetic HTTP recordings matching the official API v2 response envelopes.
// No live account, credentials or fiscal document is used by this transport.
import { InvoicingError, type InvoiceInput } from "./types";
import { invoiceFixture } from "./test-fixtures";
import type { FicRecord, FicInvoiceStore } from "./fic/store";
import type { FicCompany } from "./fic/config";
import type { FicDocument } from "./fic/schemas";
import { FIC_ORIGIN } from "./fic/http";
export class MemoryFicInvoiceStore implements FicInvoiceStore {
  readonly records = new Map<string, FicRecord>();
  private readonly inputs = new Map<string, InvoiceInput>();
  async prepare(input: InvoiceInput, companyId: number, fingerprint: string) {
    const existing = this.records.get(input.invoiceId);
    if (existing) {
      if (
        existing.company_id !== companyId ||
        existing.fingerprint !== fingerprint
      )
        throw new InvoicingError("conflict");
      return { ...existing };
    }
    const record: FicRecord = {
      invoice_id: input.invoiceId,
      company_id: companyId,
      fingerprint,
      state: "prepared",
      document_id: null,
      document_number: null,
    };
    this.records.set(input.invoiceId, record);
    this.inputs.set(input.invoiceId, structuredClone(input));
    return { ...record };
  }
  async markAttempt(id: string) {
    const record = this.records.get(id)!;
    if (record.state !== "prepared") return false;
    record.state = "uncertain";
    return true;
  }
  async definiteFailure(id: string) {
    this.records.get(id)!.state = "prepared";
  }
  async link(id: string, documentId: number, number: string) {
    const r = this.records.get(id)!;
    if (r.document_id && r.document_id !== documentId)
      throw new InvoicingError("conflict");
    Object.assign(r, {
      state: "linked",
      document_id: documentId,
      document_number: number,
    });
  }
  async totals(companyId: number, documentId: number) {
    const record = [...this.records.values()].find(
      (r) => r.company_id === companyId && r.document_id === documentId,
    );
    const input = record && this.inputs.get(record.invoice_id);
    return input
      ? {
          netCents: input.netCents,
          vatCents: input.vatCents,
          grossCents: input.grossCents,
        }
      : null;
  }
  async owns(companyId: number, documentId: number) {
    return [...this.records.values()].some(
      (r) => r.company_id === companyId && r.document_id === documentId,
    );
  }
}
export const ficFixtureCompany: FicCompany = {
  companyId: 12345,
  supplierVat: "12345678901",
  numeration: "/MDC",
  vatIds: { "22": 0 },
};
export function ficFixtureCompanies() {
  return { [invoiceFixture().brandId]: structuredClone(ficFixtureCompany) };
}
export const ficFixtureWebhook = {
  audience: "https://mdc.example.test/api/webhooks/invoicing",
  applicationId: "9876",
};
type RequestDocument = {
  type: "invoice";
  date: string;
  subject: string;
  numeration: string;
  entity: { name: string; vat_number: string; tax_code: string };
  currency: { id: "EUR" };
  e_invoice: boolean;
  items_list: Array<{ qty: number; net_price: number }>;
  payments_list: Array<{ amount: number; status: "not_paid" }>;
};
export class FicHttpRecording {
  readonly calls: Array<{
    url: string;
    method: string;
    body: unknown;
    headers: Headers;
  }> = [];
  readonly documents = new Map<number, FicDocument>();
  readonly bin = new Map<number, FicDocument>();
  failCreation: number | "network" | "network-before" | null = null;
  totalsOffset = 0;
  constructor(readonly input = invoiceFixture()) {}
  fetch: typeof fetch = async (source, options) => {
    const url = new URL(String(source)),
      method = options?.method ?? "GET",
      body = options?.body ? JSON.parse(String(options.body)) : undefined;
    this.calls.push({
      url: url.toString(),
      method,
      body,
      headers: new Headers(options?.headers),
    });
    if (url.origin !== FIC_ORIGIN) throw Error("Unexpected origin");
    if (
      url.pathname === `/c/${ficFixtureCompany.companyId}/issued_documents/info`
    )
      return Response.json({
        data: {
          countries_list: ["Italia", "Francia"],
          vat_types_list: [{ id: 0, value: 22, is_disabled: false }],
        },
      });
    if (url.pathname.endsWith("/totals"))
      return Response.json({
        data: {
          amount_net: this.input.netCents / 100 + this.totalsOffset,
          amount_vat: this.input.vatCents / 100,
          amount_gross: this.input.grossCents / 100,
        },
      });
    if (url.pathname === `/c/${ficFixtureCompany.companyId}/issued_documents`) {
      if (method === "GET") {
        const q = url.searchParams.get("q") ?? "";
        const marker = q.match(/^any_subject = '(.*)'$/)?.[1];
        if (!marker) return new Response(null, { status: 422 });
        return Response.json({
          data: [...this.documents.values()].filter(
            (doc) => doc.subject === marker,
          ),
        });
      }
      if (method === "POST") {
        const failure = this.failCreation;
        this.failCreation = null;
        if (typeof failure === "number")
          return Response.json(
            {
              error: {
                message: "synthetic sensitive response must not escape",
                code: "ERROR",
              },
            },
            { status: failure },
          );
        if (failure === "network-before")
          throw Error("synthetic transport failure");
        const payload = body.data as RequestDocument;
        const id = 500 + this.documents.size;
        const doc: FicDocument = {
          id,
          type: "invoice",
          number: 17 + this.documents.size,
          numeration: payload.numeration,
          date: payload.date,
          subject: payload.subject,
          entity: payload.entity,
          currency: payload.currency,
          e_invoice: payload.e_invoice,
          locked: false,
          ei_status: "not_sent",
          payments_list: payload.payments_list,
          amount_net: this.input.netCents / 100,
          amount_vat: this.input.vatCents / 100,
          amount_gross: this.input.grossCents / 100,
        };
        this.documents.set(id, doc);
        if (failure === "network")
          throw Error("synthetic timeout after external commit");
        return Response.json({ data: doc });
      }
    }
    const match = /^\/c\/12345\/(bin\/)?issued_documents\/(\d+)$/.exec(
      url.pathname,
    );
    if (match) {
      const id = Number(match[2]),
        map = match[1] ? this.bin : this.documents,
        doc = map.get(id);
      if (!doc) return new Response(null, { status: 404 });
      if (method === "GET") return Response.json({ data: doc });
      if (method === "DELETE" && !match[1]) {
        this.bin.set(id, doc);
        this.documents.delete(id);
        return Response.json({});
      }
    }
    return new Response(null, { status: 404 });
  };
}
