import { setAppearance, signOut } from "./helpers/account";
import { completeAdminMfa } from "./helpers/mfa";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
const password = "Orders-flow-test-42";
let email: string;
let userId: string;
let brandId: string;
let seasonId: string;
let customerId: string;
let orderId: string;
const productIds: string[] = [];
let accountEmail: string;
let accountId: string;
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import Papa from "papaparse";
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
  email = `orders-flow-${crypto.randomUUID()}@example.test`;
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
  accountEmail = `orders-account-${crypto.randomUUID()}@example.test`;
  const account = await admin().auth.admin.createUser({
    email: accountEmail,
    password,
    email_confirm: true,
  });
  accountId = account.data.user!.id;
  await admin()
    .from("profiles")
    .update({ role: "accounting" })
    .eq("id", accountId);
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
  if (brandId) {
    const file = `/tmp/mdc-order-flow-${brandId}.sql`;
    writeFileSync(
      file,
      `do $$begin delete from public.order_lines where brand_id='${brandId}';delete from public.order_status_history where brand_id='${brandId}';delete from public.order_private where brand_id='${brandId}';delete from public.orders where brand_id='${brandId}';end $$;`,
    );
    try {
      execFileSync(
        "pnpm",
        ["exec", "supabase", "db", "query", "--local", "--file", file],
        { stdio: "pipe" },
      );
    } finally {
      rmSync(file);
    }
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
  if (accountId) await admin().auth.admin.deleteUser(accountId);
});
test("lists filters transitions history duplicate and CSV with role restrictions", async ({
  page,
}, testInfo) => {
  const db = session();
  await db.auth.signInWithPassword({ email, password });
  const variant = (
    await admin()
      .from("product_variants")
      .select("id")
      .eq("product_id", productIds[0])
      .limit(1)
  ).data![0];
  const saved = await db.rpc("save_order", {
    p_id: null,
    p_data: {
      brand_id: brandId,
      customer_id: customerId,
      season_id: seasonId,
      order_date: "2026-10-12",
      delivery_date: "",
      payment_terms: "30 giorni",
      discount_pct: 0,
      commission_pct_override: null,
      internal_notes: "Note prova flusso",
    },
    p_lines: [
      {
        variant_id: variant.id,
        quantity: 2,
        unit_price_cents: 1999,
        discount_pct: 0,
      },
    ],
  });
  expect(saved.error).toBeNull();
  orderId = saved.data!;
  const number = (
    await admin().from("orders").select("number").eq("id", orderId).single()
  ).data!.number;
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await completeAdminMfa(page);
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto(
    `/orders?brand_id=${brandId}&customer_id=${customerId}&season_id=${seasonId}&from=2026-10-01&to=2026-10-31`,
  );
  await expect(
    page
      .getByRole("link", { name: number, exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  const toolbar = page.getByRole("main").locator(".list-toolbar");
  await expect(toolbar.getByRole("searchbox")).toHaveCount(0);
  await expect(toolbar.locator("details")).toHaveCount(0);
  await expect(
    page.getByRole("main").locator('input[type="date"]'),
  ).toHaveCount(0);
  const statusFilter = toolbar.getByRole("button", {
    name: "Stato",
    exact: true,
  });
  expect((await statusFilter.boundingBox())!.width).toBeLessThan(180);
  await statusFilter.focus();
  await statusFilter.press("Enter");
  const picker = page
    .getByRole("dialog", { name: "Stato", exact: true })
    .getByRole("combobox");
  await expect(picker).toBeFocused();
  await picker.fill("Bozza");
  await picker.press("ArrowDown");
  await picker.press("Enter");
  await expect(page).toHaveURL(/status=draft/);
  await expect(
    toolbar.getByRole("button", { name: "Stato: Bozza", exact: true }),
  ).toBeFocused();
  await toolbar.getByRole("button", { name: "Cerca", exact: true }).click();
  const search = toolbar.getByRole("searchbox");
  await expect(search).toBeFocused();
  await expect(toolbar.locator(".table-filter-trigger")).toHaveCount(0);
  await search.fill("48,78");
  await search.press("Enter");
  await expect(
    page.getByRole("main").getByText("1 elemento", { exact: true }),
  ).toBeVisible();
  await search.press("Escape");
  await expect(
    toolbar.getByRole("button", { name: "Cerca", exact: true }),
  ).toBeFocused();
  await expect(
    toolbar.getByRole("button", { name: "Stato: Bozza", exact: true }),
  ).toBeVisible();
  expect(
    await toolbar.locator(".table-filter-trigger").evaluateAll((buttons) =>
      buttons.every((button) => {
        const box = button.getBoundingClientRect();
        return [...button.querySelectorAll(".table-filter-copy, svg")].every(
          (child) => {
            const bounds = child.getBoundingClientRect();
            return bounds.left >= box.left && bounds.right <= box.right;
          },
        );
      }),
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("order-inline-filters.png"),
    fullPage: true,
  });
  const csvResponse = await page.request.get(
    `/api/orders/export?brand_id=${brandId}&status=draft`,
  );
  expect(csvResponse.status()).toBe(200);
  const csv = Papa.parse<string[]>(await csvResponse.text(), {
    delimiter: ";",
  });
  expect(csv.data).toHaveLength(2);
  expect(csv.data[1][0]).toBe(number);
  expect(csv.data[1][8]).toBe("48,78");
  await page
    .getByRole("main")
    .getByRole("checkbox", { name: `Seleziona ${number}`, exact: true })
    .check();
  const selectedDownload = page.waitForEvent("download");
  await page
    .getByRole("main")
    .getByRole("button", { name: "Esporta selezione CSV", exact: true })
    .click();
  expect((await selectedDownload).suggestedFilename()).toBe("orders.csv");
  expect(
    (
      await page.request.get(
        `/api/orders/export?ids=${orderId}&status=confirmed`,
      )
    ).status(),
  ).toBe(200);
  expect(
    Papa.parse<string[]>(
      await (
        await page.request.get(
          `/api/orders/export?ids=${orderId}&status=confirmed`,
        )
      ).text(),
      { delimiter: ";", skipEmptyLines: true },
    ).data,
  ).toHaveLength(1);
  expect((await page.request.get("/api/orders/export?ids=bad")).status()).toBe(
    400,
  );
  const bad = await page.request.get("/api/orders/export?brand_id=bad");
  expect(bad.status()).toBe(400);
  await page
    .getByRole("link", { name: number, exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("heading", { name: `Ordine ${number}`, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Avvia produzione", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Annulla ordine", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Mantieni ordine" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page
    .getByLabel("Nota per il cambio di stato (facoltativa)")
    .fill("Cliente approva");
  for (const action of [
    "Conferma ordine",
    "Avvia produzione",
    "Segna come spedito",
    "Segna come consegnato",
  ]) {
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(
      page.getByText("Stato dell’ordine aggiornato.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: action, exact: true }),
    ).toHaveCount(0);
  }
  await expect(
    page
      .getByRole("region", { name: "Storico stati" })
      .getByText("Cliente approva", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Annulla ordine", exact: true }),
  ).toHaveCount(0);
  const history = await admin()
    .from("order_status_history")
    .select("to_status")
    .eq("order_id", orderId)
    .order("changed_at");
  expect(history.data?.map((row) => row.to_status)).toEqual([
    "draft",
    "confirmed",
    "in_production",
    "shipped",
    "delivered",
  ]);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("order-detail.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Duplica in bozza", exact: true })
    .click();
  await expect(page).toHaveURL(/edit\?duplicated=1$/);
  await expect(
    page.getByText("Ordine duplicato in una nuova bozza.", { exact: false }),
  ).toBeVisible();
  const copyId = new URL(page.url()).pathname.split("/")[2];
  expect(copyId).not.toBe(orderId);
  const copy = await admin()
    .from("orders")
    .select("status,number,gross_total_cents")
    .eq("id", copyId)
    .single();
  expect(copy.data?.status).toBe("draft");
  expect(copy.data?.number).not.toBe(number);
  expect(copy.data?.gross_total_cents).toBe(4878);
  await page.goto(`/orders?brand_id=${brandId}&status=confirmed`);
  await expect(
    page.getByRole("link", { name: number, exact: true }),
  ).toHaveCount(0);
  await page.goto(`/orders/${copyId}`);
  await page
    .getByRole("button", { name: "Archivia ordine", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Archivia ordine", exact: true })
    .click();
  await expect(page).toHaveURL(/\/orders$/);
  await page.goto("/dashboard");
  await signOut(page);
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email", { exact: true }).fill(accountEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await completeAdminMfa(page);
  await expect(page).toHaveURL(/dashboard$/);
  await page.goto(`/orders/${orderId}`);
  await expect(
    page.getByRole("button", { name: "Duplica in bozza", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Avvia produzione", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Genera fattura", exact: true }),
  ).toBeVisible();
  expect(
    (await admin().from("orders").select("status").eq("id", orderId).single())
      .data?.status,
  ).toBe("delivered");
  await expect(
    page.getByRole("button", { name: "Segna come fatturato", exact: true }),
  ).toHaveCount(0);
  await setAppearance(page, "Scuro");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await admin().from("profiles").update({ role: "brand" }).eq("id", accountId);
  await signOut(page);
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel("Email", { exact: true }).fill(accountEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await completeAdminMfa(page);
  await expect(page).toHaveURL(/portal\/dashboard$/);
  expect(
    (await page.request.get(`/api/orders/export?brand_id=${brandId}`)).status(),
  ).toBe(403);
});
