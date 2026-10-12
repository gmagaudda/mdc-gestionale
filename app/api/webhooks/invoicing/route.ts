import { createAdminClient } from "@/lib/supabase/admin";
import { invoicingProviderName } from "@/lib/invoicing";
import { verifyMockWebhook } from "@/lib/invoicing/webhook";
import { InvoicingError } from "@/lib/invoicing/types";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function POST(request: Request) {
  try {
    const provider = invoicingProviderName();
    if (provider !== "mock")
      return new Response(null, { status: 503, headers });
    const event = await verifyMockWebhook(
      request,
      process.env.INVOICING_WEBHOOK_SECRET ?? "",
    );
    // Only this verified callback uses the service client and its narrow RPC grant.
    const result = await createAdminClient().rpc("apply_invoice_webhook", {
      p_provider: provider,
      p_event_id: event.eventId,
      p_external_id: event.externalId,
      p_status: event.status,
    });
    if (result.error)
      return new Response(null, {
        status:
          result.error.code === "P0002"
            ? 404
            : result.error.code === "23505"
              ? 409
              : 503,
        headers,
      });
    return Response.json({ received: true, applied: result.data }, { headers });
  } catch (error) {
    return new Response(null, {
      status:
        error instanceof InvoicingError && error.code === "unauthorized"
          ? 401
          : error instanceof InvoicingError && error.code === "invalid_input"
            ? 400
            : 503,
      headers,
    });
  }
}
