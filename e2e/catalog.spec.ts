import { setAppearance } from "./helpers/account";
import { completeAdminMfa } from "./helpers/mfa";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import { navigateMenu } from "./helpers/navigation";
const password = "Catalog-local-test-42";
let email: string;
let staffId: string;
let brandId: string;
let seasonId: string;
let productId: string;
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
  email = `catalog-${crypto.randomUUID()}@example.test`;
  const user = await db().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!user.data.user) throw Error("Fixture error");
  staffId = user.data.user.id;
  await db().from("profiles").update({ role: "staff" }).eq("id", staffId);
  const brand = await db()
    .from("brands")
    .insert({ name: `Catalogo ${crypto.randomUUID()}` })
    .select("id")
    .single();
  if (!brand.data) throw Error("Brand fixture error");
  brandId = brand.data.id;
});
test.afterAll(async () => {
  if (productId) {
    await db().from("product_variants").delete().eq("product_id", productId);
    await db().from("products").delete().eq("id", productId);
  }
  if (seasonId) await db().from("seasons").delete().eq("id", seasonId);
  if (brandId) await db().from("brands").delete().eq("id", brandId);
  if (staffId) await db().auth.admin.deleteUser(staffId);
});
test("staff creates a season and fifteen variants with exact prices and archives the product", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await completeAdminMfa(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await navigateMenu(page, "Stagioni");
  await page.getByRole("link", { name: "Nuova stagione", exact: true }).click();
  const brandName = (
    await db().from("brands").select("name").eq("id", brandId).single()
  ).data!.name;
  await page.getByLabel("Brand", { exact: true }).click();
  await page.getByRole("option", { name: brandName, exact: true }).click();
  await page.getByLabel("Codice stagione").fill("FW26");
  await page.getByLabel("Nome", { exact: true }).fill("Autunno inverno 2026");
  await page.getByLabel("Inizio campagna").fill("2026-08-01");
  await page.getByLabel("Fine campagna").fill("2026-07-01");
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page.getByLabel("Fine campagna")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Fine campagna")).toBeFocused();
  await page.getByLabel("Fine campagna").fill("2026-09-30");
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page).toHaveURL(/\/seasons\/[\da-f-]+\?saved=1$/);
  seasonId = new URL(page.url()).pathname.split("/").at(-1)!;
  await navigateMenu(page, "Prodotti");
  await page.getByRole("link", { name: "Nuovo prodotto", exact: true }).click();
  await page.getByLabel("Brand", { exact: true }).click();
  await page.getByRole("option", { name: brandName, exact: true }).click();
  await page.getByLabel("Stagione", { exact: true }).click();
  await page
    .getByRole("option", { name: "FW26: Autunno inverno 2026", exact: true })
    .click();
  await page.getByLabel("SKU base").fill(`SHIRT-${crypto.randomUUID()}`);
  await page.getByLabel("Nome", { exact: true }).fill("Camicia dimostrativa");
  await page
    .getByRole("spinbutton", { name: "Prezzo wholesale", exact: true })
    .fill("123,45");
  await page
    .getByRole("spinbutton", { name: "Prezzo retail", exact: true })
    .fill("210,50");
  await page.getByLabel("Taglie", { exact: true }).fill("XS, S, M, L, XL");
  await page.getByLabel("Colori", { exact: true }).fill("Bianco, Blu, Nero");
  await expect(
    page.getByRole("status").filter({ hasText: "15 varianti" }),
  ).toBeVisible();
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
    path: testInfo.outputPath("catalog-form.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(page).toHaveURL(/\/products\/[\da-f-]+\?saved=1$/);
  productId = new URL(page.url()).pathname.split("/").at(-1)!;
  const saved = await db()
    .from("products")
    .select("wholesale_price_cents,retail_price_cents,product_variants(id)")
    .eq("id", productId)
    .single();
  expect(saved.data?.wholesale_price_cents).toBe(12345);
  expect(saved.data?.retail_price_cents).toBe(21050);
  expect(saved.data?.product_variants).toHaveLength(15);
  await expect(
    page.getByRole("status").filter({ hasText: "15 varianti" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Modifica prodotto", exact: true })
    .click();
  await page.getByLabel("Nome", { exact: true }).fill("Camicia aggiornata");
  await page.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Camicia aggiornata", exact: true }),
  ).toBeVisible();
  await setAppearance(page, "Scuro");
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
  await page
    .getByRole("button", { name: "Archivia prodotto", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Conferma archiviazione", exact: true })
    .click();
  await expect(page).toHaveURL(/\/products$/);
  expect(
    (
      await db()
        .from("products")
        .select("deleted_at")
        .eq("id", productId)
        .single()
    ).data?.deleted_at,
  ).toBeTruthy();
});
