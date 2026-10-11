import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { sendInviteEmail } from "@/lib/email";
import { inviteSchema } from "@/modules/users/schema";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const reply = (error: string, status: number) =>
    NextResponse.json({ ok: false, error }, { status, headers });
  const user = await getSessionUser();
  if (user?.role !== "admin") return reply("forbidden", 403);
  const origin = request.headers.get("origin");
  if (!process.env.APP_URL || origin !== new URL(process.env.APP_URL).origin)
    return reply("forbidden", 403);
  if (process.env.EMAIL_MODE !== "log") return reply("emailUnavailable", 503);
  const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reply("validation", 400);
  const client = await createClient();
  const existing = await client
    .from("profiles")
    .select("id")
    .eq("email", parsed.data.email)
    .maybeSingle();
  if (existing.error) return reply("saveError", 503);
  if (existing.data) return reply("exists", 409);
  if (parsed.data.brand_ids.length) {
    const brands = await client
      .from("brands")
      .select("id")
      .in("id", parsed.data.brand_ids)
      .is("deleted_at", null);
    if (brands.error || brands.data.length !== parsed.data.brand_ids.length)
      return reply("validation", 400);
  }
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email: parsed.data.email,
    options: {
      data: { full_name: parsed.data.full_name },
      redirectTo: new URL("/auth/confirm", process.env.APP_URL).href,
    },
  });
  if (error || !data.user || !data.properties) return reply("exists", 409);
  const id = data.user.id;
  const saved = await client.rpc("save_user", {
    p_id: id,
    p_full_name: parsed.data.full_name,
    p_role: parsed.data.role,
    p_is_active: parsed.data.is_active,
    p_brand_ids: parsed.data.brand_ids,
  });
  if (saved.error) {
    await admin.auth.admin.deleteUser(id);
    return reply("saveError", 503);
  }
  const link = new URL("/auth/confirm", process.env.APP_URL);
  link.searchParams.set("token_hash", data.properties.hashed_token);
  link.searchParams.set("type", "invite");
  try {
    await logAudit({
      action: "invite",
      tableName: "profiles",
      recordId: id,
      after: { email: parsed.data.email, role: parsed.data.role },
    });
    await sendInviteEmail(parsed.data.email, link.href);
  } catch {
    await admin.auth.admin.deleteUser(id);
    return reply("saveError", 503);
  }
  revalidatePath("/settings/users");
  return NextResponse.json({ ok: true, data: id }, { headers });
}
