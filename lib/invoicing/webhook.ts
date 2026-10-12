import { z } from "zod";
import {
  externalStatusSchema,
  InvoicingError,
  type InvoiceWebhook,
} from "./types";
const payloadSchema = z.strictObject({
  eventId: z.uuid(),
  externalId: z.string().min(1).max(200),
  status: externalStatusSchema,
});
export const MAX_WEBHOOK_BYTES = 16384;
// Authenticate the exact bytes and timestamp before parsing JSON. Web Crypto works on Workers.
export async function signMockWebhook(
  body: string,
  timestamp: string,
  secret: string,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`),
  );
  return Array.from(new Uint8Array(signature), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
export async function verifyMockWebhook(
  request: Request,
  secret: string,
  now: () => number = Date.now,
): Promise<InvoiceWebhook> {
  if (secret.length < 32) throw new InvoicingError("unauthorized");
  const timestamp = request.headers.get("x-invoicing-timestamp") ?? "";
  const signature = request.headers.get("x-invoicing-signature") ?? "";
  if (
    !/^\d{10}$/.test(timestamp) ||
    !/^[a-f0-9]{64}$/.test(signature) ||
    Math.abs(now() / 1000 - Number(timestamp)) > 300
  )
    throw new InvoicingError("unauthorized");
  const reader = request.body?.getReader();
  if (!reader) throw new InvoicingError("invalid_input");
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_WEBHOOK_BYTES) {
        await reader.cancel();
        throw new InvoicingError("invalid_input");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let body: string;
  try {
    body = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new InvoicingError("invalid_input");
  }
  const expected = await signMockWebhook(body, timestamp, secret);
  let difference = 0;
  for (let i = 0; i < expected.length; i++)
    difference |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  if (difference) throw new InvoicingError("unauthorized");
  try {
    return payloadSchema.parse(JSON.parse(body));
  } catch {
    throw new InvoicingError("invalid_input");
  }
}
