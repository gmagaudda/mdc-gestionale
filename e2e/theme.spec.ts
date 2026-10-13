import {
  openAccountSettings,
  openUserMenu,
  setAppearance,
  signOut,
} from "./helpers/account";
import AxeBuilder from "@axe-core/playwright";
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

test("failed sign out announces an error, restores focus and allows retry", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.route("**/dashboard", (route) => {
    if (
      route.request().method() === "POST" &&
      route.request().headers()["next-action"]
    )
      return route.abort("failed");
    return route.continue();
  });
  await signOut(page);
  await expect(
    page.getByRole("alert").filter({ hasText: messages.common.logoutError }),
  ).toContainText(messages.common.logoutError);
  await expect(
    page.getByRole("button", { name: /^Menu utente di / }),
  ).toBeFocused();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.unroute("**/dashboard");
  await signOut(page);
  await expect(page).toHaveURL(/\/login$/);
});

test("account menu has Italian entries, keyboard focus and accessible settings at narrow widths", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const trigger = page.getByRole("button", {
    name: "Menu utente di Verifica tema",
    exact: true,
  });
  await expect(
    page.locator("summary").filter({ hasText: "Preferenze utente" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Esci", exact: true }),
  ).toHaveCount(0);
  for (const theme of ["Chiaro", "Scuro"]) {
    await setAppearance(page, theme, true);
    await expect(trigger).toBeFocused();
    await trigger.press("ArrowDown");
    await expect(
      page.getByRole("menuitem", { name: "Aspetto", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("End");
    await expect(
      page.getByRole("menuitem", { name: "Esci", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Home");
    await page.keyboard.press("n");
    await expect(
      page.getByRole("menuitem", {
        name: "Notifiche",
        exact: true,
      }),
    ).toBeFocused();
    await expect(page.getByRole("menuitem")).toHaveText([
      "Aspetto",
      "Installa app",
      "Notifiche",
      "Esci",
    ]);
    await page.waitForTimeout(400);
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
    if (info.project.use.hasTouch) {
      for (const item of await page.getByRole("menuitem").all())
        expect((await item.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({
      path: info.outputPath(`account-${theme}.png`),
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(page.getByRole("menu")).toHaveCount(0);
  }
  await openAccountSettings(page, "Aspetto");
  await expect(
    page.getByRole("dialog", { name: "Aspetto", exact: true }),
  ).toContainText("Sistema");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  // Stress the account controls on a list, outside the dashboard metric region.
  await page.goto("/customers");
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  await openUserMenu(page);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  for (const item of await page.getByRole("menuitem").all()) {
    expect(
      await item.evaluate((button) => {
        const label = button.lastElementChild!;
        const range = document.createRange();
        range.selectNodeContents(label);
        const text = range.getBoundingClientRect();
        const box = button.getBoundingClientRect();
        return (
          text.left >= box.left &&
          text.right <= box.right &&
          text.top >= box.top &&
          text.bottom <= box.bottom
        );
      }),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await openAccountSettings(page, "Aspetto");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
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
  await setAppearance(page, "Chiaro");
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
