import type { Database } from "@/lib/supabase/types";
export type Role = Database["public"]["Enums"]["app_role"];
export const internalRoles: Role[] = ["admin", "staff", "accounting"];
export function homeForRole(role: Role) {
  return role === "brand" ? "/portal/dashboard" : "/dashboard";
}
export function hasRole(role: Role, allowed: readonly Role[]) {
  return allowed.includes(role);
}
// Restrict destinations to this app; prevent protocol-relative URLs and encoded bypasses.
export function safeNext(value: unknown, fallback = "/dashboard") {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\r\n]/.test(decoded)) return fallback;
    const url = new URL(value, "https://app.local");
    return url.origin === "https://app.local"
      ? `${url.pathname}${url.search}`
      : fallback;
  } catch {
    return fallback;
  }
}
