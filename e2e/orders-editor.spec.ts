import { writeFileSync } from "node:fs";
import { selectChoice } from "./helpers/navigation";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
const password = "Orders-editor-test-42";
let email: string;
let userId: string;
let brandId: string;
let seasonId: string;
let customerId: string;
let orderId: string;
const productIds: string[] = [];
const productNames = [
  "Camicia di prova",
  "Pantalone di prova",
  "Giacca di prova",
];
const admin = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
const session = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
test.beforeAll(async () => {
  if (
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
    )
  )
    throw Error("Local fixtures only");
  email = `orders-editor-${crypto.randomUUID()}@example.test`;
  const user = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!user.data.user) throw Error("User fixture error");
  userId = user.data.user.id;
  await admin().from("profiles").update({ role: "staff" }).eq("id", userId);
  const brand = await admin()
    .from("brands")
    .insert({ name: `Ordini ${crypto.randomUUID()}` })
    .select("id")
    .single();
  if (!brand.data) throw Error("Brand fixture error");
  brandId = brand.data.id;
  const customer = await admin()
    .from("customers")
    .insert({
      legal_name: `Cliente ordini ${crypto.randomUUID()}`,
      city: "Milano",
    })
    .select("id")
    .single();
  if (!customer.data) throw Error("Customer fixture error");
  customerId = customer.data.id;
  const db = session();
  await db.auth.signInWithPassword({ email, password });
  const season = await db
    .from("seasons")
    .insert({ brand_id: brandId, code: "FW26-EDITOR", name: "Autunno prova" })
    .select("id")
    .single();
  if (!season.data) throw Error("Season fixture error");
  seasonId = season.data.id;
  for (let index = 0; index < 3; index++) {
    const product = await db.rpc("save_product", {
      p_id: null,
      p_data: {
        brand_id: brandId,
        season_id: seasonId,
        sku_base: `EDIT-${crypto.randomUUID()}`,
        name: productNames[index],
        description: "",
        wholesale_price_cents: [1999, 1299, 2499][index],
        retail_price_cents: 5000,
        vat_rate: 22,
        sizes: ["S", "M", "L"],
        colors: ["Blu", "Nero"],
      },
    });
    if (!product.data) throw Error("Product fixture error");
    productIds.push(product.data);
  }
});
test.afterAll(async () => {
  if (orderId) {
    const db = session();
    await db.auth.signInWithPassword({ email, password });
    const lines = await db.from("order_lines").delete().eq("order_id", orderId);
    if (lines.error) throw lines.error;
    await admin().from("order_status_history").delete().eq("order_id", orderId);
    await admin().from("order_private").delete().eq("id", orderId);
    await admin().from("orders").delete().eq("id", orderId);
  }
  if (productIds.length) {
    await admin()
      .from("product_variants")
      .delete()
      .in("product_id", productIds);
    await admin().from("products").delete().in("id", productIds);
  }
  if (seasonId) await admin().from("seasons").delete().eq("id", seasonId);
  if (customerId) await admin().from("customers").delete().eq("id", customerId);
  if (brandId) await admin().from("brands").delete().eq("id", brandId);
  if (userId) await admin().auth.admin.deleteUser(userId);
});
test("saves a three-product matrix atomically with discounts and exact server totals", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/orders/new");
  await page.getByRole("button", { name: "Salva bozza", exact: true }).click();
  await expect(page.getByLabel("Brand", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Brand", { exact: true })).toBeFocused();
  const brand = (
    await admin().from("brands").select("name").eq("id", brandId).single()
  ).data!.name;
  const customer = (
    await admin()
      .from("customers")
      .select("legal_name")
      .eq("id", customerId)
      .single()
  ).data!.legal_name;
  await page.getByLabel("Cerca Brand", { exact: true }).fill(brand);
  await selectChoice(page, "Brand", brand);
  await selectChoice(page, "Stagione", "FW26-EDITOR: Autunno prova");
  await page.getByLabel("Cerca Cliente", { exact: true }).fill(customer);
  await expect(page.getByLabel("Cliente", { exact: true })).toBeEnabled();
  await selectChoice(page, "Cliente", `${customer} · Milano`);
  for (const name of productNames) {
    await selectChoice(page, "Prodotto da aggiungere", name, true);
    await page
      .getByRole("button", { name: "Aggiungi prodotto", exact: true })
      .click();
  }
  const product = (name: string) =>
    page
      .locator("section.order-product")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
  await product(productNames[0])
    .getByLabel("Blu, M", { exact: true })
    .fill("3");
  await product(productNames[0])
    .getByLabel("Nero, L", { exact: true })
    .fill("2");
  await product(productNames[1])
    .getByLabel("Blu, S", { exact: true })
    .fill("1");
  await product(productNames[2])
    .getByLabel("Nero, M", { exact: true })
    .fill("4");
  await page.getByLabel("Sconto ordine (%)", { exact: true }).fill("10");
  await product(productNames[0])
    .getByText("Prezzi e sconti per variante", { exact: true })
    .click();
  const firstLine = product(productNames[0])
    .locator("fieldset")
    .filter({ has: page.locator("legend").filter({ hasText: "Blu · M" }) });
  await firstLine
    .getByRole("spinbutton", { name: "Prezzo unitario", exact: true })
    .fill("20,00");
  await firstLine.getByLabel("Sconto riga (%)", { exact: true }).fill("12.5");
  await page
    .getByLabel("Note interne", { exact: true })
    .fill("Nota riservata di prova");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("order-editor.png"),
    fullPage: true,
  });
  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll("body *"))
      .filter((element) => element.getBoundingClientRect().right > innerWidth)
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        width: element.getBoundingClientRect().width,
        right: element.getBoundingClientRect().right,
      }))
      .slice(0, 30),
  );
  writeFileSync(testInfo.outputPath("overflow.json"), JSON.stringify(overflow));
  await testInfo.attach("overflow.json", {
    body: JSON.stringify(overflow),
    contentType: "application/json",
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByRole("button", { name: "Salva bozza", exact: true }).click();
  await expect(page).toHaveURL(/\/orders\/[\da-f-]+\/edit\?saved=1$/);
  orderId = new URL(page.url()).pathname.split("/")[2];
  const saved = await admin()
    .from("orders")
    .select(
      "net_total_cents,vat_total_cents,gross_total_cents,order_lines(*),order_private(*)",
    )
    .eq("id", orderId)
    .single();
  expect(saved.data?.order_lines).toHaveLength(4);
  expect(saved.data?.net_total_cents).toBe(18488);
  expect(saved.data?.vat_total_cents).toBe(4068);
  expect(saved.data?.gross_total_cents).toBe(22556);
  expect(saved.data?.order_private?.[0]?.internal_notes).toBe(
    "Nota riservata di prova",
  );
  await expect(
    page.getByRole("region", {
      name: "Totali salvati dal server",
      exact: true,
    }),
  ).toContainText("225,56");
  await page
    .locator("summary")
    .filter({ hasText: "Preferenze utente" })
    .click();
  await page.getByRole("button", { name: "Scuro", exact: true }).click();
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
  await page.reload();
  await expect(
    product(productNames[0]).getByLabel("Blu, M", { exact: true }),
  ).toHaveValue("3");
  await expect(page.getByLabel("Note interne", { exact: true })).toHaveValue(
    "Nota riservata di prova",
  );
});
