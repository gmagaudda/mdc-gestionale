import { setAppearance } from "./helpers/account";
import { completeAdminMfa } from "./helpers/mfa";
import { selectChoice } from "./helpers/navigation";
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
const password = "Budgets-local-fixture-42",
  name = `Budget ${crypto.randomUUID()}`;
let email: string,
  userId: string,
  staffEmail: string,
  staffId: string,
  brandId: string,
  seasonId: string,
  customerId: string;
const db = () =>
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
  const admin = db();
  email = `budget-${crypto.randomUUID()}@example.test`;
  staffEmail = `budget-staff-${crypto.randomUUID()}@example.test`;
  userId = (
    await admin.auth.admin.createUser({ email, password, email_confirm: true })
  ).data.user!.id;
  staffId = (
    await admin.auth.admin.createUser({
      email: staffEmail,
      password,
      email_confirm: true,
    })
  ).data.user!.id;
  await admin
    .from("profiles")
    .update({ role: "accounting", full_name: "Persona budget" })
    .eq("id", userId);
  await admin
    .from("profiles")
    .update({ role: "staff", full_name: "Lettura budget" })
    .eq("id", staffId);
  brandId = (await admin.from("brands").insert({ name }).select("id").single())
    .data!.id;
  seasonId = (
    await admin
      .from("seasons")
      .insert({ brand_id: brandId, code: "BUDGET", name })
      .select("id")
      .single()
  ).data!.id;
  customerId = (
    await admin
      .from("customers")
      .insert({ legal_name: name })
      .select("id")
      .single()
  ).data!.id;
});
test.afterAll(async () => {
  const admin = db();
  if (brandId) {
    await admin.from("budget_private").delete().eq("brand_id", brandId);
    await admin.from("budgets").delete().eq("brand_id", brandId);
  }
  if (seasonId) await admin.from("seasons").delete().eq("id", seasonId);
  if (customerId) await admin.from("customers").delete().eq("id", customerId);
  if (brandId) await admin.from("brands").delete().eq("id", brandId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  if (staffId) await admin.auth.admin.deleteUser(staffId);
});
async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await completeAdminMfa(page);
  await expect(
    page.getByRole("button", { name: /^Menu utente di / }),
  ).toBeVisible();
}
async function fill(page: Page, start: string, end: string) {
  for (const [label, search, result] of [
    ["Brand", name, name],
    ["Stagione (facoltativa)", name, `BUDGET · ${name}`],
    ["Cliente (facoltativo)", name, name],
  ]) {
    await page.getByRole("combobox", { name: label, exact: true }).fill(search);
    await expect(
      page.getByRole("combobox", { name: label, exact: true }),
    ).toBeEnabled();
    await selectChoice(page, label, result);
  }
  await page.getByLabel("Importo netto", { exact: true }).fill("1234,56");
  await page.getByLabel("Inizio periodo", { exact: true }).fill(start);
  await page.getByLabel("Fine periodo", { exact: true }).fill(end);
  await page
    .getByLabel("Note interne", { exact: true })
    .fill("Nota interna budget di prova");
}
test("accounting validates periods writes cents and archives while staff reads", async ({
  page,
  browser,
}, info) => {
  await login(page, email);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/budgets/new");
  await page.getByRole("button", { name: "Salva budget", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Brand", exact: true }),
  ).toBeFocused();
  await fill(page, "2032-01-01", "2031-12-31");
  await page.getByRole("button", { name: "Salva budget", exact: true }).click();
  await expect(page.getByLabel("Fine periodo", { exact: true })).toBeFocused();
  await expect
    .poll(() =>
      page
        .getByRole("alert")
        .evaluateAll((alerts) =>
          alerts.every((alert) =>
            [alert, ...alert.querySelectorAll("span")].every(
              (node) => getComputedStyle(node).opacity === "1",
            ),
          ),
        ),
    )
    .toBe(true);
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("budget-form.png"),
    fullPage: true,
  });
  await page.getByLabel("Fine periodo", { exact: true }).fill("2032-01-31");
  await page.getByRole("button", { name: "Salva budget", exact: true }).click();
  await expect(page).toHaveURL(/\/budgets\/[a-f0-9-]+\?saved=1$/);
  const firstId = new URL(page.url()).pathname.split("/").pop()!;
  expect(
    (
      await db()
        .from("budgets")
        .select("amount_cents,season_id,customer_id")
        .eq("id", firstId)
        .single()
    ).data,
  ).toMatchObject({
    amount_cents: 123456,
    season_id: seasonId,
    customer_id: customerId,
  });
  await page.goto("/budgets/new");
  await fill(page, "2032-01-31", "2032-02-28");
  await page.getByRole("button", { name: "Salva budget", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Esiste già un budget" }),
  ).toBeVisible();
  expect(
    (await db().from("budgets").select("id").eq("brand_id", brandId)).data,
  ).toHaveLength(1);
  await page.getByLabel("Inizio periodo", { exact: true }).fill("2032-02-01");
  await page.getByRole("button", { name: "Salva budget", exact: true }).click();
  await expect(page).toHaveURL(/\/budgets\/[a-f0-9-]+\?saved=1$/);
  await page.goto(`/budgets/${firstId}/edit`);
  await page
    .getByRole("textbox", { name: "Importo netto", exact: true })
    .fill("4321,10");
  await page.getByRole("button", { name: "Salva budget", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/budgets/${firstId}\\?saved=1$`));
  expect(
    (
      await db()
        .from("budgets")
        .select("amount_cents")
        .eq("id", firstId)
        .single()
    ).data?.amount_cents,
  ).toBe(432110);
  for (const theme of ["Chiaro", "Scuro"]) {
    await setAppearance(page, theme);
    expect(
      (await new AxeBuilder({ page }).analyze()).violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("budget-detail.png"),
    fullPage: true,
  });
  const staffContext = await browser.newContext({
      baseURL: new URL(page.url()).origin,
    }),
    staffPage = await staffContext.newPage();
  await login(staffPage, staffEmail);
  await staffPage.goto(`/budgets/${firstId}`);
  await expect(staffPage.getByRole("heading", { level: 1 })).toHaveText(
    `Budget: ${name}`,
  );
  await expect(
    staffPage.getByRole("link", { name: "Modifica budget", exact: true }),
  ).toHaveCount(0);
  await staffPage.goto("/budgets/new");
  await expect(staffPage.getByRole("heading", { level: 1 })).toHaveText("404");
  await expect(
    staffPage.getByRole("button", { name: "Salva budget", exact: true }),
  ).toHaveCount(0);
  await staffContext.close();
  await page
    .getByRole("button", { name: "Archivia budget", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Annulla", exact: true }),
  ).toBeFocused();
  await dialog
    .getByRole("button", { name: "Conferma archiviazione", exact: true })
    .click();
  await expect(page).toHaveURL(/\/budgets$/);
  await page
    .getByRole("searchbox", { name: "Cerca per brand", exact: true })
    .fill(name);
  await page.getByRole("button", { name: "Cerca", exact: true }).click();
  await expect(
    page.getByRole("link", { name, exact: true }).first(),
  ).toBeVisible();
  expect(
    (
      await db()
        .from("budgets")
        .select("id")
        .eq("brand_id", brandId)
        .is("deleted_at", null)
    ).data,
  ).toHaveLength(1);
  expect(errors).toEqual([]);
});
