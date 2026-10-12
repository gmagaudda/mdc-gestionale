"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { homeForRole, safeNext } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/errors";
import { emailSchema, loginSchema, passwordSchema } from "./schema";

export async function login(
  input: unknown,
  next?: string,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  if (!hasSupabaseConfig()) return { ok: false, error: "unavailable" };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { ok: false, error: "credentials" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role,is_active")
    .eq("id", data.user.id)
    .single();
  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return { ok: false, error: "inactive" };
  }
  const home = homeForRole(profile.role);
  const destination = safeNext(next, home);
  // A brand account never follows an internal destination from a login link.
  redirect(
    profile.role === "brand" && !destination.startsWith("/portal/")
      ? home
      : destination,
  );
}

export async function requestReset(input: unknown): Promise<ActionResult> {
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "validation" };
  if (!hasSupabaseConfig() || !process.env.APP_URL)
    return { ok: false, error: "unavailable" };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: new URL("/auth/confirm", process.env.APP_URL).href },
  );
  (await cookies()).set("auth-pending-recovery", "true", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_URL.startsWith("https:"),
    path: "/",
    maxAge: 900,
  });
  // Do not disclose account existence. Rate-limit/service errors still permit recovery.
  if (error && error.status && error.status >= 429)
    return { ok: false, error: "retryLater" };
  return { ok: true, data: undefined };
}

export async function setPassword(input: unknown): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "passwordRules" };
  const store = await cookies();
  if (!["recovery", "invite"].includes(store.get("auth-flow")?.value ?? ""))
    return { ok: false, error: "expired" };
  const supabase = await createClient();
  const { data: identity } = await supabase.auth.getUser();
  if (!identity.user) return { ok: false, error: "expired" };
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { ok: false, error: "passwordRules" };
  store.delete("auth-flow");
  await supabase.auth.signOut({ scope: "global" });
  redirect("/login?password=updated");
}

export async function logout(): Promise<ActionResult> {
  if (hasSupabaseConfig()) {
    const client = await createClient();
    // Signing out revokes all notification consent for this account before its session ends.
    const identity = await client.auth.getUser();
    if (identity.data.user) {
      const revoked = await client.rpc("revoke_push_subscription", {});
      if (revoked.error) return { ok: false, error: "logoutError" };
    }
    const signedOut = await client.auth.signOut();
    if (signedOut.error) return { ok: false, error: "logoutError" };
  }
  (await cookies()).delete("auth-flow");
  redirect("/login");
}

export async function currentHome() {
  const user = await getSessionUser();
  return user ? homeForRole(user.role) : "/login";
}
