import { z } from "zod";
import { FicHttpError, FIC_ORIGIN, readJson, type FicTransport } from "./http";
import { InvoicingError } from "../types";
const inputSchema = z.discriminatedUnion("grant_type", [
  z.strictObject({
    grant_type: z.literal("refresh_token"),
    client_id: z.string().min(1),
    client_secret: z.string().min(1),
    refresh_token: z.string().min(1),
  }),
  z.strictObject({
    grant_type: z.literal("authorization_code"),
    client_id: z.string().min(1),
    client_secret: z.string().min(1),
    code: z.string().min(1),
    redirect_uri: z.url(),
    code_verifier: z.string().min(43).max(128),
  }),
]);
const tokenSchema = z.object({
  token_type: z.literal("bearer"),
  access_token: z.string().min(1).max(8192),
  refresh_token: z.string().min(1).max(8192),
  expires_in: z.number().int().positive(),
});
// Caller must persist the rotated refresh token securely before replacing its previous credential.
// Runtime uses an env access token. No automatic refresh that would lose rotation across Workers isolates.
export async function exchangeFicToken(
  raw: unknown,
  transport: FicTransport = fetch,
) {
  const parsed = inputSchema.safeParse(raw);
  if (!parsed.success) throw new InvoicingError("invalid_input");
  let response: Response;
  try {
    response = await transport(`${FIC_ORIGIN}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new InvoicingError("unavailable", true);
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new FicHttpError(response.status);
  }
  const tokens = tokenSchema.safeParse(await readJson(response, 32768));
  if (!tokens.success) throw new InvoicingError("unavailable");
  return tokens.data;
}
