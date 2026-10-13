import { signOut } from "./helpers/account";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import { totp } from "./helpers/mfa";
let id: string, email: string;
const password = "Mfa-local-fixture-42";
const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
test.beforeAll(async () => {
  if (
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
    )
  )
    throw Error("Local fixtures only");
  email = `mfa-${crypto.randomUUID()}@example.test`;
  const result = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (result.error) throw result.error;
  id = result.data.user!.id;
  const updated = await admin()
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", id);
  if (updated.error) throw updated.error;
});
test.afterAll(async () => {
  if (id) await admin().auth.admin.deleteUser(id);
});
test("admin enrolls, wrong code fails, aal1 is denied and re-login needs TOTP", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  let cspViolations = 0;
  page.on("console", (message) => {
    if (/content security policy|violates.*directive/i.test(message.text()))
      cspViolations++;
  });
  const login = async () => {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Accedi", exact: true }).click();
    await expect(page).toHaveURL(/\/mfa/);
  };
  await login();
  expect((await page.request.get("/api/imports/template")).status()).toBe(403);
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  expect(
    (await client.auth.signInWithPassword({ email, password })).error,
  ).toBeNull();
  expect((await client.from("brands").select("id").limit(1)).data).toEqual([]);
  expect(
    (
      await client.rpc("start_import_batch", {
        p_id: crypto.randomUUID(),
        p_kind: "budgets",
        p_filename: "mfa.csv",
        p_sha256: "e".repeat(64),
        p_size: 10,
      })
    ).error?.code,
  ).toBe("42501");
  await page.goto("/orders");
  await expect(page).toHaveURL(/\/mfa\?next=/);
  await page
    .getByRole("button", { name: "Configura autenticazione", exact: true })
    .click();
  const secret = page.getByLabel("Chiave di configurazione", { exact: true });
  await expect(secret).toBeVisible();
  const key = await secret.inputValue();
  for (const theme of ["Chiaro", "Scuro"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`mfa-${theme}.png`),
      fullPage: true,
      mask: [secret, page.getByRole("img")],
    });
  }
  const code = totp(key),
    wrong = code.slice(0, 5) + String((Number(code[5]) + 1) % 10);
  await page.getByLabel("Codice a 6 cifre", { exact: true }).fill(wrong);
  await page
    .getByRole("button", { name: "Verifica e accedi", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Inserisci il codice" }).first(),
  ).toBeVisible();
  await expect(
    page.getByLabel("Codice a 6 cifre", { exact: true }),
  ).toBeFocused();
  await page.getByLabel("Codice a 6 cifre", { exact: true }).fill(totp(key));
  await page
    .getByRole("button", { name: "Verifica e accedi", exact: true })
    .click();
  await expect(page).toHaveURL(/\/orders$/);
  expect((await page.request.get("/api/imports/template")).status()).toBe(200);
  await signOut(page);
  await expect(page).toHaveURL(/\/login$/);
  await login();
  await expect(
    page.getByRole("button", { name: "Configura autenticazione", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Codice a 6 cifre", { exact: true }).fill(totp(key));
  await page
    .getByRole("button", { name: "Verifica e accedi", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(cspViolations).toBe(0);
});
