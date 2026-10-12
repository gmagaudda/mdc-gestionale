"use server";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  pushSubscriptionSchema,
  pushEndpointSchema,
} from "@/lib/pwa/push-schema";
import { pushConfig } from "@/lib/pwa/push-config";
import { deliverPush } from "@/lib/pwa/push-delivery";
import type { ActionResult } from "@/lib/errors";
const roles = ["admin", "staff", "accounting", "brand"] as const;
export async function savePushSubscription(
  input: unknown,
): Promise<ActionResult> {
  await requireRole(roles);
  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (!pushConfig()) return { ok: false, error: "unconfigured" };
  const db = await createClient();
  const { error } = await db.rpc("subscribe_push", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
  });
  return error
    ? { ok: false, error: "saveError" }
    : { ok: true, data: undefined };
}
export async function readPushSubscription(
  endpoint: unknown,
): Promise<ActionResult<boolean>> {
  await requireRole(roles);
  const parsed = pushEndpointSchema.safeParse(endpoint);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const db = await createClient();
  const { data, error } = await db.rpc("has_push_subscription", {
    p_endpoint: parsed.data,
  });
  return error ? { ok: false, error: "saveError" } : { ok: true, data };
}
export async function revokePushSubscription(
  endpoint: unknown,
): Promise<ActionResult> {
  await requireRole(roles);
  const parsed = pushEndpointSchema.safeParse(endpoint);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const db = await createClient();
  const { error } = await db.rpc("revoke_push_subscription", {
    p_endpoint: parsed.data,
  });
  return error
    ? { ok: false, error: "saveError" }
    : { ok: true, data: undefined };
}
export async function revokeAllPushSubscriptions(): Promise<ActionResult> {
  await requireRole(roles);
  const db = await createClient();
  const { error } = await db.rpc("revoke_push_subscription", {});
  return error
    ? { ok: false, error: "saveError" }
    : { ok: true, data: undefined };
}
export async function sendTestPush(input: unknown): Promise<ActionResult> {
  await requireRole(["admin", "staff", "accounting"]);
  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const config = pushConfig();
  if (!config) return { ok: false, error: "unconfigured" };
  const db = await createClient();
  const claimed = await db.rpc("claim_push_test", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
  });
  if (claimed.error) return { ok: false, error: "saveError" };
  if (!claimed.data) return { ok: false, error: "testWait" };
  const result = await deliverPush(
    parsed.data,
    crypto.randomUUID(),
    config,
    fetch,
    "test",
  );
  if (result.expired)
    await db.rpc("revoke_push_subscription", {
      p_endpoint: parsed.data.endpoint,
    });
  return result.status === "sent"
    ? { ok: true, data: undefined }
    : { ok: false, error: "testError" };
}
