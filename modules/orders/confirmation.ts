"use server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { deliverEmail } from "@/lib/email";
import {
  orderConfirmationSchema,
  renderOrderConfirmation,
} from "@/lib/email/order-confirmation";
import type { ActionResult } from "@/lib/errors";
import { revalidatePath } from "next/cache";
const inputSchema = z.strictObject({ orderId: z.uuid(), contactId: z.uuid() });
const completed = z.strictObject({
  state: z.enum(["sent", "logged"]),
  duplicate: z.literal(true),
});
const claimed = z.strictObject({
  state: z.literal("pending"),
  id: z.uuid(),
  lease: z.uuid(),
  recipient: z.email(),
  payload: orderConfirmationSchema,
});
export async function sendOrderConfirmation(
  input: unknown,
): Promise<ActionResult<"sent" | "logged">> {
  await requireRole(["admin", "staff"]);
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "recipientError" };
  const db = await createClient();
  const result = await db.rpc("prepare_order_confirmation", {
    p_order_id: parsed.data.orderId,
    p_contact_id: parsed.data.contactId,
    p_mode: process.env.EMAIL_MODE === "log" ? "log" : "resend",
  });
  if (result.error)
    return {
      ok: false,
      error:
        result.error.code === "55P03"
          ? "busy"
          : result.error.code === "23514"
            ? "recipientError"
            : result.error.code === "54000"
              ? "limitError"
              : "sendError",
    };
  const done = completed.safeParse(result.data);
  if (done.success) return { ok: true, data: done.data.state };
  // Parse claim identifiers separately so a malformed payload can still release
  // its lease rather than leaving a failed render pending for ten minutes.
  const identity = z
    .object({ id: z.uuid(), lease: z.uuid() })
    .safeParse(result.data);
  if (!identity.success) return { ok: false, error: "sendError" };
  let delivered = false;
  try {
    const job = claimed.parse(result.data);
    const message = await renderOrderConfirmation(job.payload);
    const state = await deliverEmail(
      { to: job.recipient, ...message },
      `order-confirmation-${job.id}`,
    );
    delivered = true;
    const finish = await db.rpc("finish_order_confirmation", {
      p_id: job.id,
      p_lease: job.lease,
      p_state: state,
    });
    if (finish.error) return { ok: false, error: "uncertain" };
    revalidatePath(`/orders/${parsed.data.orderId}`);
    return { ok: true, data: state };
  } catch {
    if (delivered) return { ok: false, error: "uncertain" };
    await db.rpc("finish_order_confirmation", {
      p_id: identity.data.id,
      p_lease: identity.data.lease,
      p_state: "failed",
    });
    revalidatePath(`/orders/${parsed.data.orderId}`);
    return { ok: false, error: "sendError" };
  }
}
