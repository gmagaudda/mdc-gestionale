import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import messages from "@/messages/it.json";
const password = "Theme-local-fixture-42";
let email: string, userId: string;
const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
test.beforeAll(async () => {
  email = `theme-${crypto.randomUUID()}@example.test`;
  const result = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (result.error) throw result.error;
  userId = result.data.user.id;
  expect(
    (
      await admin()
        .from("profiles")
        .update({ role: "staff", full_name: "Verifica tema" })
        .eq("id", userId)
    ).error,
  ).toBeNull();
});
test.afterAll(async () => {
  if (userId) await admin().auth.admin.deleteUser(userId);
});
test("theme persists before real page content is painted and does not overflow", async ({
  page,
}) => {
  // Observe first content on every navigation, but only seed the initial choice.
  // A forced value on every reload would hide a broken persistence mechanism.
  await page.addInitScript(() => {
    if (!localStorage.getItem("theme")) localStorage.setItem("theme", "dark");
    const observer = new MutationObserver(() => {
      if (
        document.querySelector("main") &&
        !document.documentElement.dataset.firstContentTheme
      )
        document.documentElement.dataset.firstContentTheme =
          document.documentElement.dataset.theme;
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    messages.auth.title,
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-first-content-theme",
    "dark",
  );
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-first-content-theme",
    "dark",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .locator("summary")
    .filter({ hasText: "Preferenze utente" })
    .click();
  await page.getByRole("button", { name: "Chiaro", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("theme")))
    .toBe("light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-first-content-theme",
    "light",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
});
