import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import { openUserMenu, setAppearance } from "./helpers/account";
const password = "Local-metrics-fixture-42";
let email: string, userId: string;
const prefix = `Metric-${crypto.randomUUID()}`;
const ids: string[] = [];
const productIds: string[] = [];
const brandId = crypto.randomUUID(),
  seasonId = crypto.randomUUID();
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
  email = `metrics-${crypto.randomUUID()}@example.test`;
  const user = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!user.data.user) throw user.error;
  userId = user.data.user.id;
  const profile = await admin()
    .from("profiles")
    .update({ role: "staff", full_name: "Verifica metriche" })
    .eq("id", userId);
  if (profile.error) throw profile.error;
  const old = new Date();
  old.setFullYear(old.getFullYear() - 1);
  const day20 = new Date();
  day20.setDate(day20.getDate() - 20);
  const rows = Array.from({ length: 153 }, (_, i) => {
    const id = crypto.randomUUID();
    ids.push(id);
    return {
      id,
      legal_name: `${prefix} ${String(i).padStart(3, "0")}`,
      city: i % 2 === 0 ? "Roma" : "Milano",
      created_at:
        i >= 151
          ? old.toISOString()
          : i === 150
            ? day20.toISOString()
            : new Date().toISOString(),
    };
  });
  const result = await admin().from("customers").insert(rows);
  if (result.error) throw result.error;
  const brand = await admin()
    .from("brands")
    .insert({ id: brandId, name: prefix });
  if (brand.error) throw brand.error;
  const season = await admin()
    .from("seasons")
    .insert({ id: seasonId, brand_id: brandId, code: "SS26", name: prefix });
  if (season.error) throw season.error;
  const products = await admin()
    .from("products")
    .insert(
      [100, 101, 999999999999].map((price, index) => {
        const id = crypto.randomUUID();
        productIds.push(id);
        return {
          id,
          brand_id: brandId,
          season_id: seasonId,
          name: `${prefix} product ${index}`,
          sku_base: `${prefix}-${index}`,
          wholesale_price_cents: price,
        };
      }),
    );
  if (products.error) throw products.error;
});
test.afterAll(async () => {
  await admin().from("products").delete().in("id", productIds);
  await admin().from("seasons").delete().eq("id", seasonId);
  await admin().from("brands").delete().eq("id", brandId);
  await admin().from("customers").delete().in("id", ids);
  if (userId) await admin().auth.admin.deleteUser(userId);
});
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
}
const metric = (page: Page, label: string) =>
  page.locator(".table-metric").filter({
    has: page.locator(
      `.metric-period-control[aria-label="Periodo per ${label}"]`,
    ),
  });
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
test("complete filtered metrics, independent periods and numbered navigation preserve table search", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await login(page);
  await page.goto(`/customers?q=${prefix}&sort=city&direction=desc`);
  await expect(page.locator(".session-header")).toHaveCount(0);
  await expect(page.locator(".table-metric")).toHaveCount(3);
  const customers = metric(page, "Clienti"),
    cities = metric(page, "Città");
  await expect(customers.locator(".metric-comparison .sr-only")).toContainText(
    "Clienti: 151",
  );
  await expect(customers.locator(".metric-comparison")).toContainText(
    /\+7\.?450%/,
  );
  await customers
    .getByRole("button", { name: "Settimana", exact: true })
    .click();
  await expect(customers.locator('[aria-haspopup="menu"]')).toHaveCount(0);
  await expect(
    customers.getByRole("button", { name: "Settimana", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(customers.locator(".metric-comparison .sr-only")).toContainText(
    "Clienti: 150",
  );
  await expect(
    cities.getByRole("button", { name: "Mese", exact: true }),
  ).toBeVisible();
  await expect(
    cities.getByRole("button", { name: "Mese", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await customers.getByRole("button", { name: "Anno", exact: true }).click();
  await expect(customers.locator(".metric-comparison .sr-only")).toContainText(
    "Clienti: 151",
  );
  await customers.getByRole("button", { name: "Totale", exact: true }).click();
  await expect(customers.locator(".metric-comparison .sr-only")).toContainText(
    "Clienti: 153",
  );
  await expect(customers.locator(".metric-comparison")).toContainText(
    "Tutto lo storico, senza limiti di data.",
  );
  await expect(customers.locator(".metric-comparison")).not.toContainText(
    "Anno precedente",
  );
  await expect(customers.locator(".metric-change")).toHaveCount(0);
  await expect(
    cities.getByRole("button", { name: "Mese", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await customers.getByRole("button", { name: "Mese", exact: true }).click();
  const pagination = page.getByRole("navigation", {
    name: "Paginazione",
    exact: true,
  });
  await expect(
    pagination.getByRole("link", { name: "Vai a pagina 7", exact: true }),
  ).toBeVisible();
  await expect(pagination).toContainText("…");
  await pagination
    .getByRole("link", { name: "Vai a pagina 3", exact: true })
    .click();
  await expect(page).toHaveURL(/page=3/);
  expect(new URL(page.url()).searchParams.get("q")).toBe(prefix);
  expect(new URL(page.url()).searchParams.get("sort")).toBe("city");
  await expect(pagination.locator('[aria-current="page"]')).toHaveText("3");
  await expect(
    page.getByRole("button", { name: "Esporta CSV", exact: true }),
  ).toBeVisible();
  await noOverflow(page);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("metrics-and-pagination.png"),
    fullPage: true,
  });
  await page.goto(`/customers?q=${prefix}&cf_city=Roma`);
  await expect(customers.locator(".metric-comparison .sr-only")).toContainText(
    "Clienti: 76",
  );
  await page.goto(`/customers?q=no-match-${prefix}`);
  await expect(customers.locator(".metric-comparison .sr-only")).toContainText(
    "Clienti: 0",
  );
  await expect(
    page.getByRole("heading", { name: "Nessun elemento", exact: true }),
  ).toBeVisible();
});
test("sidebar menu and metrics remain usable in both themes and at 320px with enlarged text", async ({
  page,
}, info) => {
  await login(page);
  await page.goto(`/customers?q=${prefix}`);
  for (const theme of ["Chiaro", "Scuro"]) {
    await setAppearance(page, theme);
    // Close the mobile navigation after changing appearance.
    const nav = page.getByRole("dialog", { name: "Menu", exact: true });
    if (await nav.isVisible())
      await nav.getByRole("button", { name: "Chiudi", exact: true }).click();
    await noOverflow(page);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  await noOverflow(page);
  for (const button of await page
    .locator(".metric-period-control button")
    .all()) {
    // Arc keeps the selected segment in view; keyboard can reach every option
    // in its contained scrolling track when enlarged labels cannot fit.
    await button.focus();
    await button.press("Enter");
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(async () => {
        const box = (await button.boundingBox())!;
        return box.x + box.width;
      })
      .toBeLessThanOrEqual(320);
    const box = (await button.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
  await openUserMenu(page);
  await expect(
    page.getByRole("menuitemcheckbox", { name: "Aspetto", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("metrics-menu-enlarged.png"),
    fullPage: true,
  });
});

test("large monetary metrics preserve cents, keyboard periods and fit narrow cards", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await login(page);
  await page.goto(`/products?q=${prefix}`);
  const price = metric(page, "Prezzo medio");
  await expect(price.locator(".metric-comparison .sr-only")).toContainText(
    "3.333.333.334,00",
  );
  const period = price.getByRole("button", {
    name: "Mese",
    exact: true,
  });
  await period.focus();
  expect(
    await period.evaluate((node) => getComputedStyle(node).outlineStyle),
  ).not.toBe("none");
  await period.press("ArrowRight");
  await expect(
    price.getByRole("button", { name: "Anno", exact: true }),
  ).toBeVisible();
  await expect(
    price.getByRole("button", { name: "Anno", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    price.getByRole("button", { name: "Anno", exact: true }),
  ).toBeFocused();
  await noOverflow(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  await noOverflow(page);
  const amount = price.locator(".metric-money-static");
  await expect(amount).toBeVisible();
  expect(
    await amount.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth;
    }),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("large-money-enlarged.png"),
    fullPage: true,
  });
});
