import { z } from "zod";
import { InvoicingError } from "../types";
import { readJson, FIC_ORIGIN } from "./http";
// ES256 public key published by Fatture in Cloud for webhook JWTs. No remotely supplied key is accepted.
export const FIC_WEBHOOK_PUBLIC_KEY =
  "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE/RoHIjgY7hfXfY5p/Jy+K/FguMZ4\n3TvZ9t4eN7+kxQ0MJzKtowv4CcYTFqrBm7hMB5ZWKnqLz24D6lQjSL0Ysw==";
export type FicWebhookOptions = {
  audience: string;
  applicationId: string;
  now?: () => number;
  publicKey?: string;
};
const claimsSchema = z.object({
  iss: z.literal(FIC_ORIGIN),
  aud: z.union([z.string(), z.array(z.string())]),
  exp: z.number().int(),
  iat: z.number().int(),
  sub: z.string().regex(/^company:[1-9]\d{0,15}$/),
  jti: z.string().min(1).max(140),
  aid: z.union([z.string(), z.number().int().positive()]),
});
function decode(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length > 12000)
    throw new InvoicingError("unauthorized");
  try {
    return Uint8Array.from(
      atob(value.replaceAll("-", "+").replaceAll("_", "/")),
      (c) => c.charCodeAt(0),
    );
  } catch {
    throw new InvoicingError("unauthorized");
  }
}
export async function verifyFicJwt(
  request: Request,
  options: FicWebhookOptions,
) {
  try {
    const token = request.headers
      .get("authorization")
      ?.match(/^Bearer ([A-Za-z0-9_.-]+)$/)?.[1];
    if (
      !token ||
      !options.applicationId ||
      !options.audience.startsWith("https://")
    )
      throw Error();
    const parts = token.split(".");
    if (parts.length !== 3) throw Error();
    const header = z
      .object({ alg: z.literal("ES256"), typ: z.literal("JWT").optional() })
      .parse(JSON.parse(new TextDecoder().decode(decode(parts[0]))));
    if (header.alg !== "ES256") throw Error();
    const pem = (options.publicKey ?? FIC_WEBHOOK_PUBLIC_KEY).replace(
      /\s/g,
      "",
    );
    const spki = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      "spki",
      spki,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const signature = decode(parts[2]);
    if (
      signature.length !== 64 ||
      !(await crypto.subtle.verify(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        signature,
        new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
      ))
    )
      throw Error();
    const claims = claimsSchema.parse(
      JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(decode(parts[1])),
      ),
    );
    const now = Math.floor((options.now ?? Date.now)() / 1000);
    if (
      claims.exp <= now ||
      claims.iat > now + 60 ||
      claims.exp <= claims.iat ||
      claims.exp - claims.iat > 10860 ||
      String(claims.aid) !== options.applicationId ||
      !(Array.isArray(claims.aud) ? claims.aud : [claims.aud]).includes(
        options.audience,
      )
    )
      throw Error();
    return claims;
  } catch {
    throw new InvoicingError("unauthorized");
  }
}
const prefix = "it.fattureincloud.webhooks.";
export const ficEventTypeSchema = z.enum([
  `${prefix}issued_documents.invoices.create`,
  `${prefix}issued_documents.invoices.update`,
  `${prefix}issued_documents.invoices.delete`,
  `${prefix}issued_documents.invoices.email_sent`,
  `${prefix}issued_documents.e_invoices.status_update`,
  `${prefix}subscriptions.welcome`,
]);
const eventSchema = z.object({
  id: z.string().min(1).max(140),
  source: z.literal(FIC_ORIGIN),
  specversion: z.literal("1.0"),
  type: ficEventTypeSchema,
  subject: z.string().regex(/^company:[1-9]\d{0,15}$/),
  time: z.iso.datetime({ offset: true }),
  data: z
    .object({
      ids: z
        .array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER))
        .max(1000)
        .default([]),
    })
    .optional(),
});
export async function verifyFicNotification(
  request: Request,
  options: FicWebhookOptions,
) {
  const claims = await verifyFicJwt(request, options);
  let raw: unknown;
  try {
    raw = await readJson(new Response(request.body), 16384);
  } catch {
    throw new InvoicingError("invalid_input");
  }
  const binary = request.headers.has("ce-id");
  if (binary) {
    const body = z.object({ data: z.unknown().optional() }).safeParse(raw);
    if (!body.success) throw new InvoicingError("invalid_input");
    raw = {
      id: request.headers.get("ce-id"),
      source: request.headers.get("ce-source"),
      specversion: request.headers.get("ce-specversion"),
      type: request.headers.get("ce-type"),
      subject: request.headers.get("ce-subject"),
      time: request.headers.get("ce-time"),
      data: body.data.data,
    };
  }
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) throw new InvoicingError("invalid_input");
  const event = parsed.data;
  if (event.id !== claims.jti || event.subject !== claims.sub)
    throw new InvoicingError("unauthorized");
  const companyId = Number(event.subject.slice(8));
  if (!Number.isSafeInteger(companyId))
    throw new InvoicingError("invalid_input");
  if (
    event.type !== `${prefix}subscriptions.welcome` &&
    !event.data?.ids.length
  )
    throw new InvoicingError("invalid_input");
  return { ...event, companyId, ids: [...new Set(event.data?.ids ?? [])] };
}
export async function ficVerificationResponse(
  request: Request,
  options: FicWebhookOptions,
) {
  await verifyFicJwt(request, options);
  const challenge =
    request.headers.get("x-fic-verification-challenge") ??
    new URL(request.url).searchParams.get("x-fic-verification-challenge");
  if (!challenge || !/^[a-f0-9]{64}$/.test(challenge))
    throw new InvoicingError("invalid_input");
  return { verification: challenge };
}
