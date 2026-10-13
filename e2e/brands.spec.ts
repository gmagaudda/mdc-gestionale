import { completeAdminMfa } from "./helpers/mfa";
import { navigateMenu } from "./helpers/navigation";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
const password = "Local-brand-test-42";
let adminEmail: string;
let staffEmail: string;
const userIds: string[] = [];
const brandIds: string[] = [];
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
  for (const role of ["admin", "staff"] as const) {
    const email = `brands-${role}-${crypto.randomUUID()}@example.test`;
    const result = await db().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (result.error || !result.data.user)
      throw Error("Fixture creation failed");
    userIds.push(result.data.user.id);
    const update = await db()
      .from("profiles")
      .update({ role })
      .eq("id", result.data.user.id);
    if (update.error) throw update.error;
    if (role === "admin") adminEmail = email;
    else staffEmail = email;
  }
});
test.afterAll(async () => {
  for (const id of brandIds) {
    await db().from("brand_contacts").delete().eq("brand_id", id);
    await db().from("brand_private").delete().eq("id", id);
    await db().from("brands").delete().eq("id", id);
  }
  for (const id of userIds) await db().auth.admin.deleteUser(id);
});
test("admin creates edits adds contacts and archives a brand", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(adminEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await completeAdminMfa(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await navigateMenu(page, "Brand");
  await page.getByRole("link", { name: "Nuovo brand" }).click();
  await page.getByLabel("Nome brand", { exact: true }).fill("Brand di prova");
  await page.getByLabel("Provvigione (%)").fill("12.25");
  const violations = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations.violations).toEqual([]);
  await page.getByRole("button", { name: "Salva brand", exact: true }).click();
  await expect(page).toHaveURL(/\/brands\/[\w-]+\?saved=1/);
  const id = new URL(page.url()).pathname.split("/").pop()!;
  brandIds.push(id);
  await expect(
    page.getByRole("heading", { name: "Brand di prova", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Modifica brand" }).click();
  await page.getByLabel("Nome brand", { exact: true }).fill("Brand aggiornato");
  await page.getByRole("button", { name: "Salva brand", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Brand aggiornato", exact: true }),
  ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Aggiungi referente" })
    .click();
  await page.getByLabel("Nome referente").fill("Referente di prova");
  await page.getByLabel("Email", { exact: true }).fill("buyer@example.test");
  await page
    .getByRole("button", { name: "Aggiungi referente", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Referente di prova" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page
    .getByRole("button", { name: "Archivia brand", exact: true })
    .click();
  await expect(
    page.getByText("Archiviare Brand aggiornato?", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Conferma archiviazione", exact: true })
    .click();
  await expect(page).toHaveURL(/\/brands$/);
  await page.goto(`/brands/${id}`);
  await expect(page.getByText("404", { exact: true })).toBeVisible();
});
test("staff reads brands but cannot access administrative forms or audit", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(staffEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await completeAdminMfa(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/brands");
  await expect(
    page.getByRole("heading", { name: "Brand", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Nuovo brand" })).toHaveCount(0);
  for (const path of ["/brands/new", "/settings/audit"]) {
    await page.goto(path);
    await expect(page.getByText("404", { exact: true })).toBeVisible();
  }
});
