import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import { completeAdminMfa } from "./helpers/mfa";
import { navigateMenu } from "./helpers/navigation";

const password = "Local-workspace-ui-fixture-42";
const accounts = new Map<string, { email: string; id: string }>();
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
  for (const role of ["admin", "staff", "accounting", "brand"] as const) {
    const email = `workspace-${role}-${crypto.randomUUID()}@example.test`;
    const result = await db().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (!result.data.user) throw Error("UI fixture creation failed");
    const id = result.data.user.id;
    accounts.set(role, { email, id });
    const profile = await db()
      .from("profiles")
      .update({ role, full_name: "Persona di prova" })
      .eq("id", id);
    if (profile.error) throw profile.error;
  }
});
test.afterAll(async () => {
  for (const { id } of accounts.values()) await db().auth.admin.deleteUser(id);
});

async function login(page: Page, role: string) {
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill(accounts.get(role)!.email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await completeAdminMfa(page);
  await expect(page).toHaveURL(/dashboard$/);
  await expect(page.locator("h1:visible")).toHaveCount(1);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function axe(page: Page) {
  // Metadata can finish streaming after the route's visible content.
  await expect(page).toHaveTitle(/MDC Gestionale/);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations).toEqual([]);
}
async function paletteContrast(page: Page) {
  const ratios = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const context = document.createElement("canvas").getContext("2d")!;
    context.canvas.width = context.canvas.height = 1;
    const luminance = (token: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = css.getPropertyValue(token).trim();
      context.fillRect(0, 0, 1, 1);
      const rgb = [...context.getImageData(0, 0, 1, 1).data]
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
    expect(ratio, name).toBeGreaterThanOrEqual(4.5);
  return ratios;
}

test("workspace navigation, active groups, focus, sage and responsive layout", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await login(page, "admin");
  await expect(page.locator("html")).toHaveAttribute("data-accent", "green");
  await noOverflow(page);
  await page
    .locator("summary")
    .filter({ hasText: "Preferenze utente" })
    .click();
  await page.getByRole("button", { name: "Chiaro", exact: true }).click();
  await page
    .locator("summary")
    .filter({ hasText: "Preferenze utente" })
    .click();
  await axe(page);
  await info.attach("sage-light-contrast", {
    body: JSON.stringify(await paletteContrast(page)),
    contentType: "application/json",
  });
  await page.screenshot({
    path: info.outputPath("workspace-light.png"),
    fullPage: true,
  });
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  const mobile = await menu.isVisible();
  if (mobile) await menu.click();
  const nav = mobile
    ? page.getByRole("dialog", { name: "Menu", exact: true })
    : page.locator(".app-sidebar");
  const catalog = nav.locator("summary").filter({ hasText: "Catalogo" });
  await catalog.focus();
  await catalog.press("Enter");
  await expect(
    nav.getByRole("link", { name: "Brand", exact: true }),
  ).toBeVisible();
  await expect(catalog).toBeFocused();
  expect(
    await catalog.evaluate((node) => getComputedStyle(node).outlineStyle),
  ).not.toBe("none");
  if (!mobile) {
    const expandedWidth = (await nav.boundingBox())!.width;
    await nav
      .getByRole("button", { name: "Riduci la sidebar", exact: true })
      .click();
    await expect(nav).toHaveAttribute("data-collapsed", "true");
    expect((await nav.boundingBox())!.width).toBeLessThan(expandedWidth);
    await expect(
      nav.getByRole("link", { name: "Fatture", exact: true }),
    ).toBeVisible();
    await nav.getByRole("link", { name: "Ordini", exact: true }).focus();
    await noOverflow(page);
    await axe(page);
    await page.screenshot({ path: info.outputPath("sidebar-collapsed.png") });
    await nav
      .getByRole("button", { name: "Cerca nella sidebar", exact: true })
      .click();
    await expect(nav).not.toHaveAttribute("data-collapsed", "true");
  }
  const sidebarSearch = nav.getByRole("searchbox", {
    name: "Cerca tra le sezioni",
    exact: true,
  });
  await sidebarSearch.fill("fatt");
  await expect(
    nav.getByRole("link", { name: "Fatture", exact: true }),
  ).toBeVisible();
  await expect(
    nav.getByRole("link", { name: "Clienti", exact: true }),
  ).toHaveCount(0);
  await sidebarSearch.fill("Amministrazione");
  await expect(
    nav.getByRole("link", { name: "Budget", exact: true }),
  ).toBeVisible();
  await sidebarSearch.fill("zzzz-no-sezione");
  await expect(
    nav.getByText("Nessuna sezione trovata. Prova un altro nome.", {
      exact: true,
    }),
  ).toBeVisible();
  await sidebarSearch.press("Escape");
  await expect(sidebarSearch).toHaveValue("");
  await noOverflow(page);
  await axe(page);
  if (!mobile) {
    await sidebarSearch.press("Escape");
    await expect(sidebarSearch).toHaveCount(0);
    await expect(
      nav.getByRole("button", { name: "Cerca nella sidebar", exact: true }),
    ).toBeFocused();
  }
  const smallTargets = await nav.locator("a, summary").evaluateAll((nodes) =>
    nodes
      .filter((n) => n.getClientRects().length > 0)
      .filter((n) => n.getBoundingClientRect().height < 43.5)
      .map((n) => n.textContent),
  );
  expect(smallTargets).toEqual([]);
  if (mobile) {
    await nav
      .getByRole("link", { name: "Documenti", exact: true })
      .click({ trial: true });
    await nav
      .locator("summary")
      .filter({ hasText: "Impostazioni" })
      .click({ trial: true });
    await nav.evaluate((node) => (node.scrollTop = 0));
  }
  await axe(page);
  await page.screenshot({
    path: info.outputPath("workspace-menu.png"),
    fullPage: true,
  });
  await page.screenshot({
    path: info.outputPath("workspace-preview.png"),
    fullPage: false,
  });
  if (mobile) {
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
  }
  await navigateMenu(page, "Brand");
  await expect(page).toHaveURL(/\/brands$/);
  if (mobile) {
    await expect(
      page.getByRole("dialog", { name: "Menu", exact: true }),
    ).not.toBeVisible();
    await menu.click();
  }
  await expect(
    nav.getByRole("link", { name: "Brand", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  if (mobile) await page.keyboard.press("Escape");
  await page
    .locator("summary")
    .filter({ hasText: "Preferenze utente" })
    .click();
  await page.getByRole("button", { name: "Scuro", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await info.attach("sage-dark-contrast", {
    body: JSON.stringify(await paletteContrast(page)),
    contentType: "application/json",
  });
  await axe(page);
  await noOverflow(page);
  await page
    .locator("summary")
    .filter({ hasText: "Preferenze utente" })
    .click();
  await page.screenshot({
    path: info.outputPath("workspace-dark.png"),
    fullPage: true,
  });
  if (info.project.name === "desktop") {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 320, height: 900 });
    await noOverflow(page);
    await menu.click();
    await axe(page);
    await page.keyboard.press("Escape");
    await page.evaluate(
      () => (document.documentElement.style.fontSize = "200%"),
    );
    await noOverflow(page);
    await menu.click();
    await noOverflow(page);
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    await page.goto("/settings/audit");
    await expect(page.locator("h1:visible")).toBeVisible();
    await noOverflow(page);
    await page.setViewportSize({ width: 768, height: 1024 });
    await noOverflow(page);
    await page.evaluate(() => (document.documentElement.style.fontSize = ""));
  }
});

for (const role of ["staff", "accounting", "brand"] as const)
  test(`role ${role} keeps its destinations`, async ({ page }, info) => {
    test.skip(
      info.project.name !== "desktop",
      "Role checks share the desktop layout; responsive admin covers all viewports",
    );
    await login(page, role);
    const nav = page.locator(".app-sidebar");
    const hrefs = await nav
      .locator("nav a")
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href")));
    expect(hrefs).not.toContain("/settings/users");
    expect(hrefs).not.toContain("/analysis");
    if (role === "brand") {
      expect(hrefs).toEqual(
        expect.arrayContaining([
          "/portal/dashboard",
          "/portal/orders",
          "/portal/sales",
          "/portal/calendar",
          "/portal/documents",
        ]),
      );
      expect(hrefs).toHaveLength(5);
    } else {
      expect(hrefs).toEqual(
        expect.arrayContaining([
          "/orders",
          "/customers",
          "/invoices",
          "/budgets",
          "/commissions",
        ]),
      );
      expect(hrefs.includes("/imports")).toBe(role === "accounting");
    }
    await navigateMenu(page, "Ordini");
    await expect(page).toHaveURL(
      role === "brand" ? /\/portal\/orders$/ : /\/orders$/,
    );
    await axe(page);
  });
