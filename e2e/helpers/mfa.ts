import { expect, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
const fixtureKeys = new Map<string, string>();
export async function enrollFixtureMfa(
  client: Pick<SupabaseClient, "auth">,
  email: string,
) {
  const enrolled = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "MDC Gestionale",
  });
  if (enrolled.error) throw Error("Synthetic MFA enrollment failed");
  fixtureKeys.set(email, enrolled.data.totp.secret);
  const verified = await client.auth.mfa.challengeAndVerify({
    factorId: enrolled.data.id,
    code: totp(enrolled.data.totp.secret),
  });
  if (verified.error) throw Error("Synthetic MFA verification failed");
}
export function totp(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
    bits = secret
      .toUpperCase()
      .replace(/=+$/, "")
      .split("")
      .map((c) => alphabet.indexOf(c).toString(2).padStart(5, "0"))
      .join("");
  const key = Buffer.from(
      Array.from({ length: Math.floor(bits.length / 8) }, (_, i) =>
        parseInt(bits.slice(i * 8, i * 8 + 8), 2),
      ),
    ),
    counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", key).update(counter).digest(),
    offset = h[19] & 15;
  return String((h.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
    6,
    "0",
  );
}
export async function completeAdminMfa(page: Page) {
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 20000 });
  if (new URL(page.url()).pathname !== "/mfa") return;
  const account = (await page.locator("[data-mfa-account]").textContent())!;
  const setup = page.getByRole("button", {
    name: "Configura autenticazione",
    exact: true,
  });
  if (await setup.isVisible()) {
    await setup.click();
    const field = page.getByLabel("Chiave di configurazione", { exact: true });
    await expect(field).toBeVisible();
    fixtureKeys.set(account, await field.inputValue());
  }
  const key = fixtureKeys.get(account);
  if (!key) throw Error("Missing MFA fixture setup for this worker");
  await page.getByLabel("Codice a 6 cifre", { exact: true }).fill(totp(key));
  await page
    .getByRole("button", { name: "Verifica e accedi", exact: true })
    .click();
  await page.waitForURL((url) => url.pathname !== "/mfa", { timeout: 20000 });
}
