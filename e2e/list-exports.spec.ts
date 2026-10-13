import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import AxeBuilder from "@axe-core/playwright";
import { listExports } from "@/lib/exports/lists";
import { readFileSync } from "node:fs";
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
        city: n === 31 ? "Milano" : "Roma",
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
test("column filters and page selection stay aligned with CSV and reset on navigation", async ({
  page,
}, info) => {
  test.setTimeout(60000);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page.locator(".app-layout")).toBeVisible();
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.evaluate(() => localStorage.removeItem("theme"));
    await page.goto(`/customers?q=${prefix}&sort=legal_name&direction=desc`);
    const main = page.getByRole("main");
    const toolbar = main.locator(".list-toolbar");
    await expect(toolbar.getByRole("searchbox")).toBeVisible();
    await expect(
      toolbar.getByRole("link", { name: "Nuovo cliente", exact: true }),
    ).toBeVisible();
    await expect(
      toolbar.getByRole("button", { name: "Esporta CSV", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath(`list-toolbar-${theme}.png`),
      fullPage: true,
    });
    await toolbar.getByRole("searchbox").press("Escape");
    await expect(toolbar.getByRole("searchbox")).toHaveCount(0);
    const cityFilter = toolbar.getByRole("button", {
      name: "Città",
      exact: true,
    });
    await cityFilter.focus();
    await cityFilter.press("Enter");
    const choices = page.getByRole("dialog", { name: "Città", exact: true });
    await expect(choices.getByRole("combobox")).toBeFocused();
    await choices.getByRole("combobox").fill("Roma");
    await expect(
      choices.getByRole("option", { name: "Roma", exact: true }),
    ).toBeVisible();
    await choices.getByRole("combobox").press("ArrowDown");
    await choices.getByRole("combobox").press("Enter");
    await expect(page).toHaveURL(/cf_city=Roma/);
    await toolbar.getByRole("button", { name: "Cerca", exact: true }).click();
    await expect(toolbar.getByRole("searchbox")).toBeFocused();
    await toolbar.getByRole("searchbox").press("Enter");
    await expect(page).toHaveURL(/cf_city=Roma/);
    await expect(page).toHaveURL(/direction=desc/);
    await expect(main.getByText("31 elementi", { exact: true })).toBeVisible();
    await expect(
      main.getByRole("table", { name: "Clienti", exact: true }),
    ).toBeVisible();
    await expect(main.locator("table")).toHaveCount(1);
    await expect(
      main.getByRole("button", {
        name: "Ordina per Città crescente",
        exact: true,
      }),
    ).toBeVisible();
    const select = main.getByRole("checkbox", {
      name: `Seleziona ${prefix} 30`,
      exact: true,
    });
    await select.focus();
    await select.press("Space");
    await expect(select).toBeChecked();
    expect((await select.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const selectPage = main.getByRole("checkbox", {
      name: "Seleziona tutte le righe di questa pagina",
      exact: true,
    });
    await expect(selectPage).toHaveAttribute("aria-checked", "mixed");
    expect(
      await selectPage.evaluate(
        (node) =>
          node.closest("th") ===
          node.closest("table")?.querySelector("thead th"),
      ),
    ).toBe(true);
    await expect(
      main.getByRole("columnheader", { name: "Seleziona", exact: true }),
    ).toHaveCount(0);
    expect(
      await select.evaluate(
        (node) =>
          node.closest("td") === node.closest("tr")?.querySelector("td"),
      ),
    ).toBe(true);

    const downloading = page.waitForEvent("download");
    await main
      .getByRole("button", { name: "Esporta selezione CSV", exact: true })
      .click();
    const csv = readFileSync((await (await downloading).path())!, "utf8");
    const data = Papa.parse<string[]>(csv, {
      delimiter: ";",
      skipEmptyLines: true,
    }).data;
    expect(data).toHaveLength(2);
    expect(data[1][0]).toBe(`${prefix} 30`);
    expect(data[1][2]).toBe("Roma");
    await selectPage.check();
    await expect(selectPage).toBeChecked();
    const pageDownload = page.waitForEvent("download");
    await main
      .getByRole("button", { name: "Esporta selezione CSV", exact: true })
      .click();
    const pageCsv = Papa.parse<string[]>(
      readFileSync((await (await pageDownload).path())!, "utf8"),
      { delimiter: ";", skipEmptyLines: true },
    ).data;
    expect(pageCsv).toHaveLength(26);
    expect(pageCsv.slice(1).every((row) => row[2] === "Roma")).toBe(true);
    await main
      .getByRole("button", { name: "Azzera selezione", exact: true })
      .click();
    await expect(selectPage).not.toBeChecked();
    await select.check();
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
    await page.screenshot({
      path: info.outputPath(`column-selection-${theme}.png`),
      fullPage: true,
    });
    await main
      .getByRole("button", {
        name: "Ordina per Ragione sociale crescente",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/direction=asc/);
    await expect(page).toHaveURL(/cf_city=Roma/);
    await expect(
      main.getByRole("button", { name: "Esporta selezione CSV", exact: true }),
    ).toHaveCount(0);
    await selectPage.check();
    await main
      .getByRole("link", { name: "Pagina successiva", exact: true })
      .click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/cf_city=Roma/);
    await expect(
      main.getByRole("button", { name: "Esporta selezione CSV", exact: true }),
    ).toHaveCount(0);
    await page.goBack();
    await expect(page).toHaveURL(/page=1/);
    await expect(
      main.getByRole("button", { name: "Esporta selezione CSV", exact: true }),
    ).toHaveCount(0);
    await main.getByRole("searchbox").press("Escape");
    await toolbar
      .getByRole("button", { name: "Città: Roma", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Città", exact: true })
      .getByRole("combobox")
      .fill("Tutti");
    await page.getByRole("option", { name: "Tutti", exact: true }).click();
    await expect(main.getByText("32 elementi", { exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(/cf_city/);
  }
  for (const [entity, filters, rows] of [
    ["products", "cf_wholesale_price_cents=123%2C45", 1],
    ["products", "cf_wholesale_price_cents=123%2C46", 0],
    ["budgets", "cf_period_start=2034-01-01&cf_amount_cents=123%2C45", 1],
    [
      "invoices",
      "cf_due_date=2026-01-31&cf_gross_cents=122%2C00&status=issued",
      1,
    ],
    ["customers", "cf_city=Milano", 1],
  ] as const) {
    const url = `/${entity}?q=${prefix}&${filters}`;
    await page.goto(url);
    await expect(
      page
        .getByRole("main")
        .getByRole("status")
        .filter({
          hasText: new RegExp(
            `^${rows == 0 ? "Nessun elemento" : rows == 1 ? "1 elemento" : `${rows} elementi`}$`,
          ),
        }),
    ).toBeVisible();
    const response = await page.request.get(
      `/api/lists${url.replace("?", "/export?")}`,
    );
    expect(response.status(), await response.text()).toBe(200);
    expect(
      Papa.parse<string[]>(await response.text(), {
        delimiter: ";",
        skipEmptyLines: true,
      }).data,
    ).toHaveLength(rows + 1);
  }
  for (const query of [
    "cf_city=Roma&ids=bad",
    "cf_city=Roma&ids=",
    "cf_notes=private",
    "cf_city=Roma&cf_legal_name=missing",
  ]) {
    const result = await page.request.get(
      `/api/lists/customers/export?q=${prefix}&${query}`,
    );
    expect(result.status()).toBe(query.includes("missing") ? 200 : 400);
    if (query.includes("missing"))
      expect(
        Papa.parse<string[]>(await result.text(), {
          delimiter: ";",
          skipEmptyLines: true,
        }).data,
      ).toHaveLength(1);
  }
  const intersection = await page.request.get(
    `/api/lists/customers/export?q=${prefix}&cf_city=Milano&ids=${customerIds[0]}`,
  );
  expect(
    Papa.parse<string[]>(await intersection.text(), {
      delimiter: ";",
      skipEmptyLines: true,
    }).data,
  ).toHaveLength(1);
  await page.goto(`/products?q=${prefix}&cf_wholesale_price_cents=invalid`);
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(
    page
      .getByRole("main")
      .getByRole("button", { name: "Esporta CSV", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("main")
    .getByRole("link", { name: "Azzera filtri per colonna", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("main").getByText("1 elemento", { exact: true }),
  ).toBeVisible();
  await page.goto(`/customers?q=${prefix}&cf_city=missing`);
  await expect(
    page
      .getByRole("main")
      .getByRole("status")
      .filter({ hasText: /^Nessun elemento$/ }),
  ).toBeVisible();
  await page
    .getByRole("main")
    .getByRole("link", { name: "Rimuovi filtri", exact: true })
    .click();
  await expect(page).toHaveURL(/\/customers$/);
  // Reflow of the complete filtered list, including the disclosure and selection.
  await page.goto(`/customers?q=${prefix}&cf_city=Roma`);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  await page
    .getByRole("main")
    .getByRole("checkbox", {
      name: "Seleziona tutte le righe di questa pagina",
      exact: true,
    })
    .check();
  const selectedButton = page
    .getByRole("main")
    .getByRole("button", { name: "Esporta selezione CSV", exact: true });
  await expect(selectedButton).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await page.getByRole("main").getByRole("searchbox").press("Escape");
  await page
    .getByRole("main")
    .getByRole("button", { name: "Città: Roma", exact: true })
    .click();
  const picker = page
    .getByRole("dialog", { name: "Città", exact: true })
    .getByRole("combobox");
  await expect(picker).toBeFocused();
  await picker.fill("Roma");
  await expect(
    page.getByRole("option", { name: "Roma", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(320);
  await picker.press("Escape");
  await page.keyboard.press("Escape");
  await page.evaluate(() => (document.documentElement.style.fontSize = ""));
});
test("general table search matches an off-page city and exported rows", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page.locator(".app-layout")).toBeVisible();
  await page.goto(`/customers?cf_legal_name=${prefix}&direction=desc`);
  const main = page.getByRole("main"),
    toolbar = main.locator(".list-toolbar");
  await expect(main.getByText("32 elementi", { exact: true })).toBeVisible();
  await expect(toolbar.getByRole("searchbox")).toHaveCount(0);
  await expect(
    main.getByRole("link", { name: `=${prefix} formula`, exact: true }),
  ).toHaveCount(0);
  await toolbar.getByRole("button", { name: "Cerca", exact: true }).click();
  await expect(toolbar.locator(".table-filter-trigger")).toHaveCount(0);
  await toolbar.getByRole("searchbox").fill("Milano");
  await toolbar.getByRole("searchbox").press("Enter");
  await expect(main.getByText("1 elemento", { exact: true })).toBeVisible();
  await expect(
    main.getByRole("link", { name: `=${prefix} formula`, exact: true }),
  ).toBeVisible();
  const response = await page.request.get(
    `/api/lists/customers/export?${new URL(page.url()).searchParams}`,
  );
  expect(response.status()).toBe(200);
  const rows = Papa.parse<string[]>(await response.text(), {
    delimiter: ";",
    skipEmptyLines: true,
  }).data;
  expect(rows).toHaveLength(2);
  expect(rows[1][2]).toBe("Milano");
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
  await expect(page.locator(".app-layout")).toBeVisible();
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
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.evaluate(() => localStorage.removeItem("theme"));
    await page.reload();
    const downloading = page.waitForEvent("download");
    await button.click();
    expect((await downloading).suggestedFilename()).toBe("customers.csv");
    await expect(
      page.getByText("CSV pronto. Download avviato.", { exact: true }),
    ).toBeVisible();
    // Measure the settled label, after Arc restores it from loading.
    await expect
      .poll(() =>
        button.locator(".list-button-copy").evaluate((label) => {
          let node: Element | null = label;
          const control = label.closest("button");
          while (node) {
            if (getComputedStyle(node).opacity !== "1") return false;
            if (node === control) return true;
            node = node.parentElement;
          }
          return false;
        }),
      )
      .toBe(true);
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

test("every list column sorts on the server and its CSV follows the same sort", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page.locator(".app-layout")).toBeVisible();
  for (const entity of [
    "brands",
    "customers",
    "seasons",
    "products",
    "budgets",
    "invoices",
  ] as const) {
    await page.goto(`/${entity}?q=${prefix}`);
    const table = page.getByRole("main").getByRole("table");
    await expect(table).toBeVisible();
    const keys = await table
      .locator("thead th[data-key]")
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-key")!.slice(6)),
      );
    for (const key of keys) {
      const header = table.locator(`thead th[data-key="_sort:${key}"]`);
      await header.getByRole("button").click();
      await expect(page).toHaveURL(new RegExp(`sort=${key}(?:&|$)`));
      await expect(header).toHaveAttribute("aria-sort", /ascending|descending/);
      const query = new URL(page.url()).searchParams;
      const response = await page.request.get(
        `/api/lists/${entity}/export?${query}`,
      );
      expect(
        response.status(),
        `${entity}.${key}: ${await response.text()}`,
      ).toBe(200);
      await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    }
  }
  for (const [entity, config] of Object.entries(listExports)) {
    for (const key of config.sort) {
      const response = await page.request.get(
        `/api/lists/${entity}/export?q=${prefix}&sort=${key}&direction=desc`,
      );
      expect(
        response.status(),
        `${entity}.${key}: ${await response.text()}`,
      ).toBe(200);
    }
  }
});
