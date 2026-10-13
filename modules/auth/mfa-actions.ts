"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { safeNext } from "@/lib/auth/roles";
import type { ActionResult } from "@/lib/errors";
async function adminIdentity() {
  const db = await createClient(),
    identity = await db.auth.getUser();
  if (identity.error || !identity.data.user) return null;
  const profile = await db
    .from("profiles")
    .select("role,is_active")
    .eq("id", identity.data.user.id)
    .single();
  if (profile.data?.role !== "admin" || !profile.data.is_active) return null;
  return { db, id: identity.data.user.id };
}
export async function enrollAdminMfa(): Promise<
  ActionResult<{ id: string; secret: string; qr: string }>
> {
  const identity = await adminIdentity();
  if (!identity) return { ok: false, error: "expired" };
  try {
    if (!(await consumeRateLimit("mfa_user", identity.id)).allowed)
      return { ok: false, error: "retryLater" };
    const factors = await identity.db.auth.mfa.listFactors();
    if (factors.error) return { ok: false, error: "unavailable" };
    if (factors.data.totp.some((f) => f.status === "verified"))
      return { ok: false, error: "mfaAlreadyEnabled" };
    for (const pending of factors.data.all.filter(
      (f) =>
        f.factor_type === "totp" &&
        f.status === "unverified" &&
        f.friendly_name === "MDC Gestionale",
    )) {
      const removed = await identity.db.auth.mfa.unenroll({
        factorId: pending.id,
      });
      if (removed.error) return { ok: false, error: "unavailable" };
    }
    const result = await identity.db.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "MDC Gestionale",
      issuer: "MDC Gestionale",
    });
    if (result.error) return { ok: false, error: "unavailable" };
    return {
      ok: true,
      data: {
        id: result.data.id,
        secret: result.data.totp.secret,
        qr: result.data.totp.qr_code,
      },
    };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
export async function verifyAdminMfa(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      id: z.uuid(),
      code: z.string().regex(/^\d{6}$/),
      next: z.string().max(1000).optional(),
    })
    .strict()
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "mfaInvalidCode" };
  const identity = await adminIdentity();
  if (!identity) return { ok: false, error: "expired" };
  try {
    if (!(await consumeRateLimit("mfa_user", identity.id)).allowed)
      return { ok: false, error: "retryLater" };
    const result = await identity.db.auth.mfa.challengeAndVerify({
      factorId: parsed.data.id,
      code: parsed.data.code,
    });
    if (result.error) return { ok: false, error: "mfaInvalidCode" };
    const level = await identity.db.auth.mfa.getAuthenticatorAssuranceLevel();
    if (level.error || level.data.currentLevel !== "aal2")
      return { ok: false, error: "unavailable" };
  } catch {
    return { ok: false, error: "unavailable" };
  }
  redirect(safeNext(parsed.data.next));
}
