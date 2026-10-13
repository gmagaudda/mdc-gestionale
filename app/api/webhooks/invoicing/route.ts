import { limitPublicRequest } from "@/lib/security/rate-limit";
import { logOperation } from "@/lib/observability/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { after } from "next/server";
import { ficWebhookOptions, invoicingProviderName } from "@/lib/invoicing";
import { verifyMockWebhook } from "@/lib/invoicing/webhook";
import { InvoicingError } from "@/lib/invoicing/types";
import {
  verifyFicNotification,
  ficVerificationResponse,
} from "@/lib/invoicing/fic/webhook";
import { processFicWebhooks } from "@/lib/invoicing/fic/job";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function POST(request: Request) {
  const limited = await limitPublicRequest(request, "webhook_ip");
  if (limited) return limited;
  try {
    const provider = invoicingProviderName();
    if (provider === "fic") {
      const event = await verifyFicNotification(request, ficWebhookOptions());
      if (event.type === "it.fattureincloud.webhooks.subscriptions.welcome")
        return Response.json({ received: true }, { headers });
      const canonical = JSON.stringify({
        companyId: event.companyId,
        type: event.type,
        ids: [...event.ids].sort((a, b) => a - b),
      });
      const digest = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(canonical),
          ),
        ),
        (b) => b.toString(16).padStart(2, "0"),
      ).join("");
      const db = createAdminClient();
      const queued = await db.rpc("enqueue_fic_webhook", {
        p_event_id: event.id,
        p_company_id: event.companyId,
        p_document_ids: event.ids,
        p_digest: digest,
      });
      if (queued.error)
        return new Response(null, {
          status: queued.error.code === "23505" ? 409 : 503,
          headers,
        });
      if (queued.data)
        after(async () => {
          try {
            const result = await processFicWebhooks(db);
            logOperation(
              "invoicing.finished",
              result.failed ? "retry" : "ok",
              result,
            );
          } catch {
            logOperation("invoicing.finished", "error");
          }
        });
      return Response.json({ received: true }, { status: 202, headers });
    }
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

export async function GET(request: Request) {
  if (invoicingProviderName() !== "fic")
    return new Response(null, { status: 404, headers });
  try {
    return Response.json(
      await ficVerificationResponse(request, ficWebhookOptions()),
      { headers },
    );
  } catch (error) {
    return new Response(null, {
      status:
        error instanceof InvoicingError && error.code === "unauthorized"
          ? 401
          : 400,
      headers,
    });
  }
}
