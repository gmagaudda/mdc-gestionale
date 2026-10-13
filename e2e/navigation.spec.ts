import { setAppearance } from "./helpers/account";
import { completeAdminMfa } from "./helpers/mfa";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import { navigateMenu } from "./helpers/navigation";
const password = "Local-navigation-test-42";
let email: string;
let userId: string;
const brandIds: string[] = [];
let prefix: string;
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
  email = `navigation-${crypto.randomUUID()}@example.test`;
  const user = await db().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Admin di prova" },
  });
  if (!user.data.user) throw Error("Fixture creation failed");
  userId = user.data.user.id;
  await db().from("profiles").update({ role: "admin" }).eq("id", userId);
  prefix = `Navigazione ${crypto.randomUUID()}`;
  const result = await db()
    .from("brands")
    .insert(
      Array.from({ length: 26 }, (_, index) => ({
        name: `${prefix} ${String(index).padStart(2, "0")}`,
        legal_name:
          "Ragione sociale di esempio con un nome molto lungo per verificare la lettura dei contenuti",
      })),
    )
    .select("id");
  if (result.error) throw result.error;
  brandIds.push(...result.data.map((row) => row.id));
});
test.afterAll(async () => {
  if (brandIds.length) await db().from("brands").delete().in("id", brandIds);
  if (userId) await db().auth.admin.deleteUser(userId);
});
test("navigation search pagination keyboard modal and themes remain accessible", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await completeAdminMfa(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  if (await menu.isVisible()) {
    await menu.click();
    await expect(
      page.getByRole("dialog", { name: "Menu", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
  }
  await navigateMenu(page, "Brand");
  await page.getByLabel("Cerca per nome").fill(prefix);
  await page.getByRole("button", { name: "Cerca", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "26 elementi" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Pagina successiva", exact: true })
    .click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByText("Pagina 2 di 2", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: `${prefix} 25`, exact: true }).click();
  await expect(
    page.getByRole("heading", { name: `${prefix} 25`, exact: true }),
  ).toBeVisible();
  const archive = page.getByRole("button", {
    name: "Archivia brand",
    exact: true,
  });
  await archive.click();
  await expect(
    page.getByRole("dialog", { name: "Archivia brand", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Annulla", exact: true }),
  ).toBeFocused();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(archive).toBeFocused();
  await setAppearance(page, "Scuro");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({
    path: testInfo.outputPath("navigation-dark.png"),
    fullPage: true,
  });
});
