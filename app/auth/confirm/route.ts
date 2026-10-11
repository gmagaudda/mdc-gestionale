import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const code = request.nextUrl.searchParams.get("code");
  const store = await cookies();
  const type =
    code && store.get("auth-pending-recovery")?.value === "true"
      ? "recovery"
      : request.nextUrl.searchParams.get("type");
  if (
    hasSupabaseConfig() &&
    (token_hash || code) &&
    (type === "recovery" || type === "invite")
  ) {
    const client = await createClient();
    const { error } = code
      ? await client.auth.exchangeCodeForSession(code)
      : await client.auth.verifyOtp({ token_hash: token_hash!, type });
    if (!error) {
      const result = NextResponse.redirect(
        new URL(
          type === "invite" ? "/accept-invite" : "/reset-password?mode=new",
          request.url,
        ),
      );
      result.cookies.set("auth-flow", type, {
        httpOnly: true,
        secure: request.nextUrl.protocol === "https:",
        sameSite: "lax",
        path: "/",
        maxAge: 900,
      });
      result.cookies.delete("auth-pending-recovery");
      result.headers.set("Cache-Control", "private, no-store");
      result.headers.set("Referrer-Policy", "no-referrer");
      return result;
    }
  }
  const result = NextResponse.redirect(
    new URL("/reset-password?error=expired", request.url),
  );
  result.headers.set("Cache-Control", "private, no-store");
  return result;
}
