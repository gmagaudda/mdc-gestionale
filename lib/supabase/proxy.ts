import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";
import { getSupabaseConfig, hasSupabaseConfig } from "./config";

const privateRoots = new Set([
  "dashboard",
  "brands",
  "customers",
  "seasons",
  "products",
  "orders",
  "calendar",
  "budgets",
  "invoices",
  "documents",
  "imports",
  "analysis",
  "settings",
  "portal",
  "mfa",
]);

export function isProtectedPath(pathname: string) {
  return privateRoots.has(pathname.split("/")[1]);
}

function redirectToLogin(request: NextRequest, response: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", request.nextUrl.pathname);
  const redirect = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  redirect.headers.set("Cache-Control", "private, no-store");
  return redirect;
}

export async function updateSession(request: NextRequest) {
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  if (!hasSupabaseConfig()) {
    return redirectToLogin(request, response);
  }

  const { url, anonKey } = getSupabaseConfig();
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(items) {
        for (const item of items) {
          request.cookies.set(item.name, item.value);
        }
        response = NextResponse.next({ request });
        for (const item of items) {
          response.cookies.set(item.name, item.value, item.options);
        }
        response.headers.set("Cache-Control", "private, no-store");
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) {
    return redirectToLogin(request, response);
  }
  if (request.nextUrl.pathname !== "/mfa" && data.claims.aal !== "aal2") {
    const profile = await supabase
      .from("profiles")
      .select("role,is_active")
      .eq("id", data.claims.sub)
      .maybeSingle();
    if (profile.data?.is_active && profile.data.role === "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/mfa";
      url.search = "";
      url.searchParams.set(
        "next",
        request.nextUrl.pathname + request.nextUrl.search,
      );
      const guarded = NextResponse.redirect(url);
      for (const cookie of response.cookies.getAll())
        guarded.cookies.set(cookie);
      guarded.headers.set("Cache-Control", "private, no-store");
      return guarded;
    }
  }
  return response;
}
