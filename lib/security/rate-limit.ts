import "server-only";
import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createAdminClient } from "@/lib/supabase/admin";
export type RateScope =
  | "login_email"
  | "login_ip"
  | "reset_email"
  | "reset_ip"
  | "mfa_user"
  | "feed_ip"
  | "feed_token"
  | "webhook_ip";
const resultSchema = z.object({
  allowed: z.boolean(),
  retry_after: z.number().int().min(0),
});
export function trustedClientIp(headers: Headers) {
  try {
    const context = getCloudflareContext();
    if (context.cf) {
      const ip = headers.get("cf-connecting-ip");
      if (ip && /^[\da-f.:]{3,45}$/i.test(ip)) return ip;
    }
  } catch {
    /* Next development has no trusted edge IP. */
  }
  return "local-or-unavailable";
}
export async function consumeRateLimit(scope: RateScope, identity: string) {
  const secret =
    process.env.RATE_LIMIT_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || secret.length < 32) throw Error("Rate limiting unavailable");
  const encoder = new TextEncoder(),
    key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  const digest = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(`${scope}:${identity.slice(0, 512)}`),
    ),
    hash = Array.from(new Uint8Array(digest), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  const result = await createAdminClient().rpc("consume_rate_limit", {
    p_scope: scope,
    p_key_hash: hash,
  });
  if (result.error) throw Error("Rate limiting unavailable");
  return resultSchema.parse(result.data);
}
export async function limitAuthAttempt(
  kind: "login" | "reset",
  email: string,
  headers: Headers,
) {
  const ip = await consumeRateLimit(`${kind}_ip`, trustedClientIp(headers));
  if (!ip.allowed) return ip;
  return consumeRateLimit(`${kind}_email`, email.trim().toLowerCase());
}
export async function limitPublicRequest(
  request: Request,
  scope: "feed_ip" | "webhook_ip",
  token?: string,
) {
  try {
    const ip = await consumeRateLimit(scope, trustedClientIp(request.headers));
    const result =
      ip.allowed && token ? await consumeRateLimit("feed_token", token) : ip;
    return result.allowed
      ? null
      : Response.json(
          { error: "RATE_LIMITED" },
          {
            status: 429,
            headers: {
              "Retry-After": String(result.retry_after),
              "Cache-Control": "private, no-store",
            },
          },
        );
  } catch {
    return Response.json(
      { error: "UNAVAILABLE" },
      { status: 503, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
