import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { setAppearance } from "./helpers/account";

const prefix = `Navigation-${crypto.randomUUID()}`;
const password = "Local-brand-navigation-42";
const email = `${prefix}@example.test`;
const brandIds = Array.from({ length: 4 }, () => crypto.randomUUID());
const seasonIds = Array.from({ length: 4 }, () => crypto.randomUUID());
const productIds: string[] = [];
let userId: string;
let initialBrandCount: number;
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
  const inventory = await admin()
    .from("brands")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null);
  if (inventory.error) throw inventory.error;
  initialBrandCount = inventory.count ?? 0;
  const user = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (user.error) throw user.error;
  userId = user.data.user!.id;
  const profile = await admin()
    .from("profiles")
    .update({ role: "staff", full_name: "Verifica brand" })
    .eq("id", userId);
  if (profile.error) throw profile.error;
  const brands = await admin()
    .from("brands")
    .insert(
      brandIds.map((id, i) => ({
        id,
        name: `${prefix} ${["A", "B", "Vuoto", "Archiviato"][i]}`,
        deleted_at: i === 3 ? new Date().toISOString() : null,
      })),
    );
  if (brands.error) throw brands.error;
  const seasons = await admin()
    .from("seasons")
    .insert(
      seasonIds.map((id, i) => ({
        id,
        brand_id: brandIds[i],
        code: "SS26",
        name: prefix,
      })),
    );
  if (seasons.error) throw seasons.error;
  const rows = [26, 2, 0, 1].flatMap((count, i) =>
    Array.from({ length: count }, (_, n) => {
      const id = crypto.randomUUID();
      productIds.push(id);
      return {
        id,
        brand_id: brandIds[i],
        season_id: seasonIds[i],
        name: `${prefix} ${i}-${String(n).padStart(2, "0")}`,
        sku_base: `${prefix}-${i}-${n}`,
        wholesale_price_cents: i === 0 ? 100 : 300,
      };
    }),
  );
  const products = await admin().from("products").insert(rows);
  if (products.error) throw products.error;
});
test.afterAll(async () => {
  for (const result of [
    await admin().from("products").delete().in("id", productIds),
    await admin().from("seasons").delete().in("id", seasonIds),
    await admin().from("brands").delete().in("id", brandIds),
  ])
    if (result.error) throw result.error;
  if (userId) await admin().auth.admin.deleteUser(userId);
});

test("brand navigation scopes rows, metrics, search, pagination and CSV and supports keyboard and narrow layouts", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto(`/products?q=${prefix}&sort=name&direction=desc`);
  const tabs = page.getByRole("tablist", { name: "Brand dei prodotti" });
  await expect(tabs).toBeVisible();
  await expect(tabs.getByRole("tab")).toHaveCount(initialBrandCount + 4);
  await expect(
    tabs.getByRole("tab", { name: `${prefix} Archiviato`, exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("columnheader", { name: "Brand", exact: true }),
  ).toHaveCount(0);
  const count = page
    .locator(".table-metric")
    .filter({ has: page.locator('[aria-label="Periodo per Prodotti"]') });
  const value = count.locator(".metric-comparison .sr-only");
  await expect(value).toContainText("Prodotti: 28");
  await tabs.getByRole("tab", { name: `${prefix} A`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`brand_id=${brandIds[0]}`));
  await expect(value).toContainText("Prodotti: 26");
  await expect(
    page
      .getByRole("table", { name: "Prodotti", exact: true })
      .locator("tbody tr"),
  ).toHaveCount(25);
  await page.getByRole("link", { name: "Vai a pagina 2", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  expect(new URL(page.url()).searchParams.get("brand_id")).toBe(brandIds[0]);
  await expect(
    page
      .getByRole("table", { name: "Prodotti", exact: true })
      .locator("tbody tr"),
  ).toHaveCount(1);
  await tabs.getByRole("tab", { name: `${prefix} B`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`brand_id=${brandIds[1]}`));
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await expect(value).toContainText("Prodotti: 2");
  expect(new URL(page.url()).searchParams.get("page")).toBeNull();
  expect(new URL(page.url()).searchParams.get("direction")).toBe("desc");
  expect(new URL(page.url()).searchParams.get("q")).toBe(prefix);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Esporta CSV", exact: true }).click();
  const csv = Papa.parse<string[]>(
    readFileSync((await (await download).path())!, "utf8"),
    { delimiter: ";", skipEmptyLines: true },
  ).data;
  expect(csv).toHaveLength(3);
  expect(csv.slice(1).every((row) => row[2] === `${prefix} B`)).toBe(true);
  const crossBrand = await page.request.get(
    `/api/lists/products/export?brand_id=${brandIds[1]}&ids=${productIds[0]}`,
  );
  expect(crossBrand.status()).toBe(200);
  expect(
    Papa.parse(await crossBrand.text(), {
      delimiter: ";",
      skipEmptyLines: true,
    }).data,
  ).toHaveLength(1);
  await page
    .getByRole("button", { name: "Ordina per Nome crescente", exact: true })
    .click();
  await expect(page).toHaveURL(/direction=asc/);
  expect(new URL(page.url()).searchParams.get("brand_id")).toBe(brandIds[1]);
  await page.reload();
  await expect(
    tabs.getByRole("tab", { name: `${prefix} B`, exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const search = page.locator(".list-toolbar").getByRole("searchbox");
  await search.fill(`${prefix} 1-00`);
  await search.press("Enter");
  await expect(value).toContainText("Prodotti: 1");
  expect(new URL(page.url()).searchParams.get("brand_id")).toBe(brandIds[1]);
  await tabs.getByRole("tab", { name: `${prefix} Vuoto`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`brand_id=${brandIds[2]}`));
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Nessun elemento", exact: true }),
  ).toBeVisible();
  await expect(value).toContainText("Prodotti: 0");
  const all = tabs.getByRole("tab", { name: "Tutti i brand", exact: true });
  await all.focus();
  await all.press("ArrowRight");
  await expect(all).toHaveAttribute("aria-selected", "false"); // Manual activation does not fetch on arrow focus.
  await tabs.getByRole("tab", { name: `${prefix} B`, exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`brand_id=${brandIds[1]}`));
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await expect(value).toContainText("Prodotti: 1");
  for (const theme of ["Chiaro", "Scuro"]) {
    await setAppearance(page, theme);
    const nav = page.getByRole("dialog", { name: "Menu", exact: true });
    if (await nav.isVisible())
      await nav.getByRole("button", { name: "Chiudi", exact: true }).click();
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
  }
  await page.screenshot({
    path: info.outputPath("product-brands.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const last = tabs.getByRole("tab").last();
  await last.focus();
  await last.press("Enter");
  await expect(last).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".product-brand-selection")).toContainText(
    await last.innerText(),
  );
  const box = (await last.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  await page.goto("/products?brand_id=invalid");
  await expect(
    page.getByText(
      "Brand non disponibile. Seleziona tutti i brand o riprova.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "Tutti i brand", exact: true }).click();
  await expect(all).toHaveAttribute("aria-selected", "true");
});
