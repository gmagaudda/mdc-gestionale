import {
  invoiceInputSchema,
  externalStatusSchema,
  InvoicingError,
  type InvoiceInput,
  type InvoiceResult,
  type InvoicingProvider,
  type ExternalStatus,
} from "./types";
import { verifyMockWebhook } from "./webhook";
export type MockInvoiceRecord = InvoiceResult & {
  idempotencyKey: string;
  fingerprint: string;
};
// Runtime adapters must persist these records. The memory implementation is for tests/spikes.
export interface MockInvoiceStore {
  putIfAbsent(record: MockInvoiceRecord): Promise<MockInvoiceRecord>;
  get(externalId: string): Promise<MockInvoiceRecord | null>;
  transition(
    externalId: string,
    status: ExternalStatus,
  ): Promise<MockInvoiceRecord>;
}
export class MockInvoicingProvider implements InvoicingProvider {
  private readonly initialStatus: ExternalStatus;
  private readonly delayMs: number;
  constructor(
    private readonly store: MockInvoiceStore,
    private readonly options: {
      initialStatus?: ExternalStatus;
      delayMs?: number;
      webhookSecret: string;
      now?: () => number;
    },
  ) {
    this.initialStatus = externalStatusSchema.parse(
      options.initialStatus ?? "issued",
    );
    this.delayMs = options.delayMs ?? 0;
    if (
      !Number.isInteger(this.delayMs) ||
      this.delayMs < 0 ||
      this.delayMs > 10000
    )
      throw new InvoicingError("invalid_input");
  }
  private async pause() {
    if (this.delayMs)
      await new Promise((resolve) => setTimeout(resolve, this.delayMs));
  }
  async createInvoice(raw: InvoiceInput): Promise<InvoiceResult> {
    const parsed = invoiceInputSchema.safeParse(raw);
    if (!parsed.success) throw new InvoicingError("invalid_input");
    const input = parsed.data;
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(input)),
    );
    const fingerprint = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    await this.pause();
    const record = await this.store.putIfAbsent({
      idempotencyKey: input.idempotencyKey,
      fingerprint,
      externalId: `mock_${input.invoiceId}`,
      status: this.initialStatus,
    });
    return { externalId: record.externalId, status: record.status };
  }
  async getStatus(externalId: string) {
    await this.pause();
    const record = await this.store.get(externalId);
    if (!record) throw new InvoicingError("not_found");
    return record.status;
  }
  async cancelInvoice(externalId: string) {
    await this.pause();
    await this.store.transition(externalId, "cancelled");
  }
  async parseWebhook(request: Request) {
    return verifyMockWebhook(
      request,
      this.options.webhookSecret,
      this.options.now,
    );
  }
}
