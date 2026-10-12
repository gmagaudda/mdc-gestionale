import { z } from "zod";
import {
  invoiceInputSchema,
  InvoicingError,
  type InvoiceInput,
  type InvoiceResult,
  type InvoicingProvider,
} from "../types";
import { FicHttpClient, FicHttpError } from "./http";
import { normalizeVat, type FicCompany } from "./config";
import {
  documentSchema,
  preCreateSchema,
  totalsSchema,
  checkTotals,
  documentStatus,
  externalFicId,
  parseExternalFicId,
  type FicDocument,
} from "./schemas";
import { invoiceFingerprint, type FicInvoiceStore } from "./store";
import { verifyFicNotification, type FicWebhookOptions } from "./webhook";
function data(raw: unknown): unknown {
  const parsed = z.object({ data: z.unknown() }).safeParse(raw);
  if (!parsed.success) throw new InvoicingError("unavailable");
  return parsed.data.data;
}
function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new InvoicingError("unavailable");
  return parsed.data;
}
export class FattureInCloudProvider implements InvoicingProvider {
  // Coalesce only calls in this instance. The SQL journal remains authoritative across isolates.
  private readonly flights = new Map<
    string,
    { fingerprint: string; promise: Promise<InvoiceResult> }
  >();
  constructor(
    private readonly http: FicHttpClient,
    private readonly store: FicInvoiceStore,
    private readonly companies: Record<string, FicCompany>,
    private readonly webhookOptions: FicWebhookOptions,
  ) {}
  async createInvoice(raw: InvoiceInput): Promise<InvoiceResult> {
    const result = invoiceInputSchema.safeParse(raw);
    if (!result.success) throw new InvoicingError("invalid_input");
    const input = result.data,
      fingerprint = await invoiceFingerprint(input);
    const flight = this.flights.get(input.idempotencyKey);
    if (flight) {
      if (flight.fingerprint !== fingerprint)
        throw new InvoicingError("conflict");
      return flight.promise;
    }
    const promise = this.create(input, fingerprint);
    this.flights.set(input.idempotencyKey, { fingerprint, promise });
    try {
      return await promise;
    } finally {
      this.flights.delete(input.idempotencyKey);
    }
  }
  private async create(
    input: InvoiceInput,
    fingerprint: string,
  ): Promise<InvoiceResult> {
    const company = this.companies[input.brandId];
    if (
      !company ||
      !input.supplier.vat_number ||
      normalizeVat(company.supplierVat) !==
        normalizeVat(input.supplier.vat_number)
    )
      throw new InvoicingError("invalid_input");
    const record = await this.store.prepare(
      input,
      company.companyId,
      fingerprint,
    );
    const marker = `mdc:${input.idempotencyKey}:${fingerprint}`;
    if (record.document_id) {
      try {
        return this.checkedResult(
          await this.document(company.companyId, record.document_id),
          input,
          marker,
        );
      } catch (error) {
        if (!(error instanceof FicHttpError) || error.status !== 404)
          throw error;
        const bin = parse(
          documentSchema,
          data(
            await this.http.request(
              `/c/${company.companyId}/bin/issued_documents/${record.document_id}`,
            ),
          ),
        );
        const result = this.checkedResult(bin, input, marker);
        return { ...result, status: "cancelled" };
      }
    }
    // any_subject is the documented filter covering internal and visible subjects.
    const query = new URLSearchParams({
      type: "invoice",
      q: `any_subject = '${marker}'`,
      fieldset: "detailed",
      per_page: "2",
    });
    const found = parse(
      z.array(documentSchema).max(2),
      data(
        await this.http.request(
          `/c/${company.companyId}/issued_documents?${query}`,
        ),
      ),
    );
    if (found.length > 1) throw new InvoicingError("conflict");
    if (found.length) {
      const doc = found[0];
      this.checkedResult(doc, input, marker);
      // A pre-existing document can only correspond to a previous recorded attempt.
      if (record.state !== "uncertain") throw new InvoicingError("conflict");
      await this.store.link(
        input.invoiceId,
        doc.id,
        `${doc.number}${doc.numeration}`,
      );
      return this.checkedResult(doc, input, marker);
    }
    // A timeout/5xx may have created the invoice. An empty search is not proof of absence.
    if (record.state === "uncertain") throw new InvoicingError("conflict");
    const info = parse(
      preCreateSchema,
      data(
        await this.http.request(
          `/c/${company.companyId}/issued_documents/info?type=invoice`,
        ),
      ),
    );
    let country: string;
    try {
      country =
        new Intl.DisplayNames(["it"], { type: "region" }).of(
          input.customer.address.country,
        ) ?? "";
    } catch {
      throw new InvoicingError("invalid_input");
    }
    if (!info.countries_list.includes(country))
      throw new InvoicingError("invalid_input");
    const items = input.lines.map((line) => {
      const id = company.vatIds[String(line.vat_rate)];
      if (
        id === undefined ||
        !info.vat_types_list.some(
          (v) => v.id === id && v.value === line.vat_rate && !v.is_disabled,
        )
      )
        throw new InvoicingError("invalid_input");
      return {
        code: line.sku,
        name: line.name,
        description: line.variant,
        qty: line.quantity,
        net_price: Number((line.net_cents / 100 / line.quantity).toFixed(8)),
        discount: 0,
        vat: { id },
        stock: false,
        apply_withholding_taxes: false,
      };
    });
    const party = input.customer;
    const payload = {
      data: {
        type: "invoice",
        date: input.issueDate,
        numeration: company.numeration,
        subject: marker,
        visible_subject: input.number,
        entity: {
          name: party.legal_name,
          vat_number: party.vat_number,
          tax_code: party.tax_code,
          address_street: party.address.street,
          address_postal_code: party.address.postal_code,
          address_city: party.address.city,
          address_province: party.address.province,
          country,
          certified_email: party.pec,
          ei_code: party.sdi_code,
        },
        currency: { id: "EUR", exchange_rate: "1" },
        language: { code: "it" },
        e_invoice: false,
        use_gross_prices: false,
        items_list: items,
        payments_list: [
          {
            amount: input.grossCents / 100,
            due_date: input.dueDate,
            status: "not_paid",
          },
        ],
        notes: input.paymentTerms,
        rivalsa: 0,
        cassa: 0,
        cassa2: 0,
        withholding_tax: 0,
        other_withholding_tax: 0,
        stamp_duty: 0,
        use_split_payment: false,
      },
      options: { fix_payments: false },
    };
    // No monetary mismatch is silently corrected. Defaults/tax exemptions must be configured explicitly.
    checkTotals(
      parse(
        totalsSchema,
        data(
          await this.http.request(
            `/c/${company.companyId}/issued_documents/totals`,
            "POST",
            { data: payload.data },
            true,
          ),
        ),
      ),
      input,
    );
    if (!(await this.store.markAttempt(input.invoiceId)))
      throw new InvoicingError("conflict");
    let response: unknown;
    try {
      response = await this.http.request(
        `/c/${company.companyId}/issued_documents`,
        "POST",
        payload,
      );
    } catch (error) {
      // These documented rejection responses did not create a document. Network failures/5xx stay uncertain.
      if (
        error instanceof FicHttpError &&
        [400, 401, 403, 404, 405, 409, 422, 429].includes(error.status)
      )
        await this.store.definiteFailure(input.invoiceId);
      throw error;
    }
    const doc = parse(documentSchema, data(response));
    // Retain a valid identity even if the provider returned different totals; a retry must not emit again.
    if (doc.subject !== marker || doc.date !== input.issueDate)
      throw new InvoicingError("conflict");
    await this.store.link(
      input.invoiceId,
      doc.id,
      `${doc.number}${doc.numeration}`,
    );
    return this.checkedResult(doc, input, marker);
  }
  private checkedResult(
    doc: FicDocument,
    input: InvoiceInput,
    marker: string,
  ): InvoiceResult {
    if (
      doc.subject !== marker ||
      doc.date !== input.issueDate ||
      doc.entity.name !== input.customer.legal_name ||
      normalizeVat(doc.entity.vat_number ?? "") !==
        normalizeVat(input.customer.vat_number) ||
      (doc.entity.tax_code ?? "") !== input.customer.tax_code
    )
      throw new InvoicingError("conflict");
    checkTotals(doc, input);
    return {
      externalId: externalFicId(
        this.companies[input.brandId].companyId,
        doc.id,
      ),
      status: documentStatus(doc),
    };
  }
  private async document(companyId: number, documentId: number) {
    const doc = parse(
      documentSchema,
      data(
        await this.http.request(
          `/c/${companyId}/issued_documents/${documentId}?fieldset=detailed`,
        ),
      ),
    );
    if (doc.id !== documentId) throw new InvoicingError("conflict");
    return doc;
  }
  private async owned(externalId: string) {
    const ids = parseExternalFicId(externalId);
    if (
      !Object.values(this.companies).some(
        (c) => c.companyId === ids.companyId,
      ) ||
      !(await this.store.owns(ids.companyId, ids.documentId))
    )
      throw new InvoicingError("not_found");
    return ids;
  }
  async getStatus(externalId: string) {
    const { companyId, documentId } = await this.owned(externalId);
    try {
      const doc = await this.document(companyId, documentId);
      const totals = await this.store.totals(companyId, documentId);
      if (!totals) throw new InvoicingError("not_found");
      checkTotals(doc, totals);
      return documentStatus(doc);
    } catch (error) {
      if (!(error instanceof FicHttpError) || error.status !== 404) throw error;
      const bin = parse(
        z.object({ id: z.literal(documentId), type: z.literal("invoice") }),
        data(
          await this.http.request(
            `/c/${companyId}/bin/issued_documents/${documentId}`,
          ),
        ),
      );
      if (bin.id !== documentId) throw new InvoicingError("not_found");
      return "cancelled" as const;
    }
  }
  async cancelInvoice(externalId: string) {
    const { companyId, documentId } = await this.owned(externalId);
    if ((await this.getStatus(externalId)) === "cancelled") return;
    const doc = await this.document(companyId, documentId);
    if (
      doc.e_invoice ||
      doc.locked ||
      (doc.ei_status && doc.ei_status !== "not_sent") ||
      doc.payments_list.some((p) => p.status !== "not_paid")
    )
      throw new InvoicingError("invalid_transition");
    // DELETE on issued_documents moves to the recoverable bin. Never call DELETE on bin.
    await this.http.request(
      `/c/${companyId}/issued_documents/${documentId}`,
      "DELETE",
    );
    if ((await this.getStatus(externalId)) !== "cancelled")
      throw new InvoicingError("unavailable", true);
  }
  async parseWebhooks(request: Request) {
    const notification = await verifyFicNotification(
      request,
      this.webhookOptions,
    );
    if (
      notification.type === "it.fattureincloud.webhooks.subscriptions.welcome"
    )
      return [];
    const events = [];
    for (const id of notification.ids) {
      const externalId = externalFicId(notification.companyId, id);
      // Only local documents can trigger upstream reads or bookkeeping updates.
      if (!(await this.store.owns(notification.companyId, id))) continue;
      events.push({
        externalId,
        eventId: `${notification.id}:${id}`,
        status: await this.getStatus(externalId),
      });
    }
    return events;
  }
  async parseWebhook(request: Request) {
    const events = await this.parseWebhooks(request);
    if (events.length !== 1) throw new InvoicingError("invalid_input");
    return events[0];
  }
}
