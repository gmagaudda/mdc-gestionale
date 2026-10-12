"use server";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hashToken, newIcalToken } from "@/lib/calendar/token";
import type { ActionResult } from "@/lib/errors";
export async function rotateCalendarFeed(): Promise<ActionResult<string>> {
  try {
    if (!(await getSessionUser())) return { ok: false, error: "FORBIDDEN" };
    const origin = new URL(process.env.APP_URL!).origin;
    const token = newIcalToken();
    const result = await (
      await createClient()
    ).rpc("rotate_ical_token", { p_hash: await hashToken(token) });
    if (result.error) return { ok: false, error: "UNAVAILABLE" };
    // The URL is shown once. The plaintext token is never stored in the database.
    return { ok: true, data: `${origin}/api/ical/${token}` };
  } catch {
    return { ok: false, error: "UNAVAILABLE" };
  }
}
export async function revokeCalendarFeed(): Promise<ActionResult> {
  try {
    if (!(await getSessionUser())) return { ok: false, error: "FORBIDDEN" };
    const result = await (await createClient()).rpc("revoke_ical_token");
    return result.error
      ? { ok: false, error: "UNAVAILABLE" }
      : { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "UNAVAILABLE" };
  }
}
