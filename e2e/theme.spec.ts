import { openUserMenu, setAppearance, signOut } from "./helpers/account";
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
      page.getByRole("menuitemcheckbox", { name: "Aspetto", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("End");
    await expect(
      page.getByRole("menuitem", { name: "Esci", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Home");
    await page.keyboard.press("n");
    await expect(
      page.getByRole("menuitemcheckbox", {
        name: "Notifiche",
        exact: true,
      }),
    ).toBeFocused();
    await expect(page.locator('[data-stop="item"]')).toHaveText([
      "Aspetto",
      "Accento",
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
      for (const item of await page.locator('[data-stop="item"]').all())
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
  await openUserMenu(page);
  await page
    .getByRole("menuitemcheckbox", { name: "Aspetto", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Aspetto", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("menuitemcheckbox", { name: "Aspetto", exact: true }),
  ).toBeFocused();
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
  for (const item of await page.locator('[data-stop="item"]').all()) {
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
  await openUserMenu(page);
  await page
    .getByRole("menuitemcheckbox", { name: "Aspetto", exact: true })
    .click();
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

test("accent palette applies immediately, persists before paint and remains keyboard accessible", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      if (
        document.querySelector("main") &&
        !document.documentElement.dataset.firstContentAccent
      )
        document.documentElement.dataset.firstContentAccent =
          document.documentElement.dataset.accent;
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto("/customers");
  for (const scheme of ["Chiaro", "Scuro"]) {
    await setAppearance(page, scheme);
    for (const [value, label] of [
      ["green", "Salvia"],
      ["blue", "Blu"],
      ["violet", "Viola"],
      ["neutral", "Neutro"],
    ]) {
      await openUserMenu(page);
      await page
        .getByRole("menuitem", { name: "Accento", exact: true })
        .click();
      const palette = page.getByRole("dialog", {
        name: "Accento",
        exact: true,
      });
      await expect(palette).toBeVisible();
      await expect(page.locator('[role="menu"]')).toHaveCount(0);
      await expect(palette.getByRole("radio", { checked: true })).toBeFocused();
      const choice = palette.getByRole("radio", { name: label, exact: true });
      await choice.check();
      await expect(page.locator("html")).toHaveAttribute("data-accent", value);
      await expect
        .poll(() =>
          page.evaluate(() => localStorage.getItem("mdc-accent") ?? "green"),
        )
        .toBe(value);
      const ratios = await page.evaluate(() => {
        const css = getComputedStyle(document.documentElement);
        const canvas = document.createElement("canvas").getContext("2d")!;
        canvas.canvas.width = canvas.canvas.height = 1;
        const luminance = (token: string) => {
          canvas.clearRect(0, 0, 1, 1);
          canvas.fillStyle = css.getPropertyValue("--surface").trim();
          canvas.fillRect(0, 0, 1, 1);
          canvas.fillStyle = css.getPropertyValue(token).trim();
          canvas.fillRect(0, 0, 1, 1);
          const rgb = [...canvas.getImageData(0, 0, 1, 1).data]
            .slice(0, 3)
            .map((c) => {
              const s = c / 255;
              return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
            });
          return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
        };
        return Object.fromEntries(
          [
            ["accentOnSurface", "--accent", "--surface"],
            ["activeNavigation", "--accent", "--accent-subtle"],
            ["primaryButton", "--accent-foreground", "--accent"],
            ["selectedControl", "--control-glyph", "--control-on"],
          ].map(([name, fg, bg]) => {
            const a = luminance(fg),
              b = luminance(bg);
            return [name, (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)];
          }),
        );
      });
      for (const [name, ratio] of Object.entries(ratios))
        expect(ratio, `${scheme}/${label}/${name}`).toBeGreaterThanOrEqual(4.5);
      await info.attach(`${scheme}-${value}-contrast`, {
        body: JSON.stringify(ratios),
        contentType: "application/json",
      });
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await choice.focus();
      await choice.press("Escape");
      await expect(palette).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: /^Menu utente di / }),
      ).toBeFocused();
    }
  }
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-first-content-accent",
    "neutral",
  );
  await page.evaluate(() => localStorage.setItem("mdc-accent", "invalid"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-first-content-accent",
    "green",
  );
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  await openUserMenu(page);
  await page.getByRole("menuitem", { name: "Accento", exact: true }).click();
  const palette = page.getByRole("dialog", { name: "Accento", exact: true });
  await expect(palette.getByRole("radio", { checked: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    palette.getByRole("radio", { name: "Blu", exact: true }),
  ).toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await palette
      .getByRole("radio", { name: "Blu", exact: true })
      .evaluate((node) => getComputedStyle(node).outlineStyle),
  ).not.toBe("none");
  for (const label of await palette.locator(".accent-choice").all()) {
    const box = (await label.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
  await page.screenshot({
    path: info.outputPath("accent-palette-enlarged.png"),
    fullPage: true,
  });
});
