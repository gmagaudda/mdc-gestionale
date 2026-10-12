import { z } from "zod";

// These are browser push services, never caller-controlled destinations.
export const PUSH_HOSTS = new Set([
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
  "wns2-*.notify.windows.com", // Matched explicitly below, never passed to DNS.
]);
export function isPushEndpoint(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      (!url.port || url.port === "443") &&
      url.pathname.length > 1 &&
      (PUSH_HOSTS.has(url.hostname) ||
        /^wns2-[a-z0-9]+\.notify\.windows\.com$/.test(url.hostname))
    );
  } catch {
    return false;
  }
}
const base64url = (bytes: number) =>
  z
    .string()
    .regex(/^[A-Za-z0-9_-]+$/)
    .refine((value) => {
      try {
        return (
          atob(value.replace(/-/g, "+").replace(/_/g, "/")).length === bytes
        );
      } catch {
        return false;
      }
    });
export const pushEndpointSchema = z.string().max(2048).refine(isPushEndpoint);
export const pushSubscriptionSchema = z
  .object({
    endpoint: pushEndpointSchema,
    expirationTime: z.number().int().nonnegative().nullable(),
    keys: z
      .object({
        p256dh: base64url(65).refine((value) => {
          try {
            return (
              atob(value.replace(/-/g, "+").replace(/_/g, "/")).charCodeAt(
                0,
              ) === 4
            );
          } catch {
            return false;
          }
        }),
        auth: base64url(16),
      })
      .strict(),
  })
  .strict();
