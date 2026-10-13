import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import AxeBuilder from "@axe-core/playwright";
const password = "Csv-local-fixture-42";
let email: string,
  userId: string,
  brandId: string,
  seasonId: string,
  productId: string,
  invoiceId: string,
  budgetId: string;
let customerIds: string[] = [];
const prefix = `CSV-${crypto.randomUUID()}`;
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
  email = `csv-${crypto.randomUUID()}@example.test`;
  const user = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (user.error) throw user.error;
  userId = user.data.user!.id;
  await admin().from("profiles").update({ role: "staff" }).eq("id", userId);
  const customers = await admin()
    .from("customers")
    .insert(
      Array.from({ length: 32 }, (_, n) => ({
        legal_name:
          n === 31
            ? `=${prefix} formula`
            : `${prefix} ${String(n).padStart(2, "0")}`,
        city: "Roma",
        notes: "Private CSV fixture note",
      })),
    )
    .select("id");
  if (customers.error) throw customers.error;
  customerIds = customers.data.map((row) => row.id);
  const brand = await admin()
    .from("brands")
    .insert({ name: prefix })
    .select("id")
    .single();
  if (brand.error) throw brand.error;
  brandId = brand.data.id;
  const season = await admin()
    .from("seasons")
    .insert({ brand_id: brandId, code: "CSV26", name: prefix })
    .select("id")
    .single();
  if (season.error) throw season.error;
  seasonId = season.data.id;
  const product = await admin()
    .from("products")
    .insert({
      brand_id: brandId,
      season_id: seasonId,
      sku_base: prefix,
      name: prefix,
      wholesale_price_cents: 12345,
    })
    .select("id")
    .single();
  if (product.error) throw product.error;
  productId = product.data.id;
  const budget = await admin()
    .from("budgets")
    .insert({
      brand_id: brandId,
      amount_cents: 12345,
      period_start: "2034-01-01",
      period_end: "2034-02-01",
    })
    .select("id")
    .single();
  if (budget.error) throw budget.error;
  budgetId = budget.data.id;
  const invoice = await admin()
    .from("invoices")
    .insert({
      number: prefix,
      brand_id: brandId,
      customer_id: customerIds[0],
      status: "issued",
      issue_date: "2026-01-01",
      due_date: "2026-01-31",
      net_cents: 10000,
      vat_cents: 2200,
      gross_cents: 12200,
    })
    .select("id")
    .single();
  if (invoice.error) throw invoice.error;
  invoiceId = invoice.data.id;
});
test.afterAll(async () => {
  if (invoiceId) await admin().from("invoices").delete().eq("id", invoiceId);
  if (budgetId) await admin().from("budgets").delete().eq("id", budgetId);
  if (productId) await admin().from("products").delete().eq("id", productId);
  if (seasonId) await admin().from("seasons").delete().eq("id", seasonId);
  if (brandId) await admin().from("brands").delete().eq("id", brandId);
  if (customerIds.length)
    await admin().from("customers").delete().in("id", customerIds);
  if (userId) await admin().auth.admin.deleteUser(userId);
});
test("filtered CSV exports include all pages, exact cents and safe cells with role guards", async ({
  page,
}) => {
  const url = `/api/lists/customers/export?q=${prefix}&sort=legal_name&direction=desc`;
  expect((await page.request.get(url)).status()).toBe(401);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Esci", exact: true }),
  ).toBeVisible();
  const response = await page.request.get(url);
  expect(response.status(), await response.text()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  const csv = await response.text();
  const rows = Papa.parse<string[]>(csv, {
    delimiter: ";",
    skipEmptyLines: true,
  }).data;
  expect(rows).toHaveLength(33);
  expect(rows[1][0]).toBe(`${prefix} 30`);
  expect(rows.at(-1)![0]).toBe(`'=${prefix} formula`);
  expect(csv).not.toContain("Private CSV fixture note");
  for (const entity of [
    "brands",
    "seasons",
    "products",
    "budgets",
    "documents",
    "invoices",
  ]) {
    const result = await page.request.get(
      `/api/lists/${entity}/export?q=${prefix}`,
    );
    expect(result.status(), await result.text()).toBe(200);
    const content = await result.text();
    if (entity === "products" || entity === "budgets")
      expect(content).toContain("123,45");
    if (entity === "invoices") expect(content).toContain("122,00");
  }
  expect(
    (
      await page.request.get(
        `/api/lists/invoices/export?q=${prefix}&status=paid`,
      )
    ).status(),
  ).toBe(200);
  expect(
    Papa.parse<string[]>(
      await (
        await page.request.get(
          `/api/lists/invoices/export?q=${prefix}&status=paid`,
        )
      ).text(),
      { delimiter: ";", skipEmptyLines: true },
    ).data,
  ).toHaveLength(1);
  expect((await page.request.get("/api/lists/audit_log/export")).status()).toBe(
    404,
  );
  expect(
    (await page.request.get("/api/lists/customers/export?sort=notes")).status(),
  ).toBe(400);
  await page.goto(`/customers?q=${prefix}&sort=legal_name&direction=desc`);
  const button = page.getByRole("button", { name: "Esporta CSV", exact: true });
  await expect(button).toBeVisible();
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.evaluate(() => localStorage.removeItem("theme"));
    await page.reload();
    const downloading = page.waitForEvent("download");
    await button.click();
    expect((await downloading).suggestedFilename()).toBe("customers.csv");
    await expect(
      page.getByText("CSV pronto. Download avviato.", { exact: true }),
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
  }
  await page.route("**/api/lists/customers/export?**", (route) =>
    route.fulfill({ status: 413 }),
  );
  await button.focus();
  await button.press("Enter");
  await expect(
    page.getByText(
      "L’esportazione supera 10.000 righe. Restringi i filtri e riprova.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.unroute("**/api/lists/customers/export?**");
  await admin().from("profiles").update({ role: "brand" }).eq("id", userId);
  expect((await page.request.get(url)).status()).toBe(403);
  await admin()
    .from("profiles")
    .update({ role: "accounting" })
    .eq("id", userId);
  expect((await page.request.get(url)).status()).toBe(200);
});
