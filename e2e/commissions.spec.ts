import { completeAdminMfa } from "./helpers/mfa";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
const password = "Commission-local-fixture-42",
  name = `=Report ${crypto.randomUUID()}`;
let email: string,
  userId: string,
  brandId: string,
  seasonId: string,
  productId: string,
  customerId: string;
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
  const db = admin();
  email = `report-${crypto.randomUUID()}@example.test`;
  userId = (
    await db.auth.admin.createUser({ email, password, email_confirm: true })
  ).data.user!.id;
  await db
    .from("profiles")
    .update({ role: "staff", full_name: "Persona report" })
    .eq("id", userId);
  brandId = (await db.from("brands").insert({ name }).select("id").single())
    .data!.id;
  await db.from("brand_private").insert({ id: brandId, commission_pct: 7.5 });
  seasonId = (
    await db
      .from("seasons")
      .insert({ brand_id: brandId, code: "REPORT", name })
      .select("id")
      .single()
  ).data!.id;
  customerId = (
    await db
      .from("customers")
      .insert({ legal_name: name, city: "Roma" })
      .select("id")
      .single()
  ).data!.id;
  productId = (
    await db
      .from("products")
      .insert({
        brand_id: brandId,
        season_id: seasonId,
        name,
        sku_base: name,
        wholesale_price_cents: 1000,
      })
      .select("id")
      .single()
  ).data!.id;
  const variant = (
    await db
      .from("product_variants")
      .insert({
        brand_id: brandId,
        product_id: productId,
        size: "M",
        color: "Nero",
        sku: name,
      })
      .select("id")
      .single()
  ).data!.id;
  const session = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  await session.auth.signInWithPassword({ email, password });
  for (const [quantity, date] of [
    [1, "2032-01-01"],
    [2, "2032-02-01"],
  ] as const) {
    const order = await session.rpc("save_order", {
      p_id: null as unknown as string,
      p_data: {
        brand_id: brandId,
        season_id: seasonId,
        customer_id: customerId,
        order_date: date,
        delivery_date: "",
        discount_pct: 0,
        commission_pct_override: quantity === 2 ? 12.25 : null,
        internal_notes: "Secret commission note",
      },
      p_lines: [
        {
          variant_id: variant,
          quantity,
          unit_price_cents: 1000,
          discount_pct: 0,
        },
      ],
    });
    if (order.error) throw order.error;
    const status = await session.rpc("change_order_status", {
      p_id: order.data!,
      p_status: "confirmed",
      p_note: "",
    });
    if (status.error) throw status.error;
  }
  await db.from("budgets").insert({
    brand_id: brandId,
    season_id: seasonId,
    amount_cents: 5000,
    period_start: "2032-01-01",
    period_end: "2032-02-28",
  });
  await session.auth.signOut();
});
test.afterAll(async () => {
  if (brandId && /^[a-f0-9-]{36}$/.test(brandId)) {
    const file = `/tmp/mdc-report-cleanup-${brandId}.sql`;
    writeFileSync(
      file,
      `do $$begin delete from public.budget_private where brand_id='${brandId}';delete from public.budgets where brand_id='${brandId}';delete from public.order_lines where brand_id='${brandId}';delete from public.order_status_history where brand_id='${brandId}';delete from public.order_private where brand_id='${brandId}';delete from public.orders where brand_id='${brandId}';end $$;`,
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
  const db = admin();
  if (productId) {
    await db.from("product_variants").delete().eq("product_id", productId);
    await db.from("products").delete().eq("id", productId);
  }
  if (seasonId) await db.from("seasons").delete().eq("id", seasonId);
  if (customerId) await db.from("customers").delete().eq("id", customerId);
  if (brandId) {
    await db.from("brand_private").delete().eq("id", brandId);
    await db.from("brands").delete().eq("id", brandId);
  }
  if (userId) await db.auth.admin.deleteUser(userId);
});
test("filters commissions and downloads an exact safe workbook", async ({
  page,
}, info) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await completeAdminMfa(page);
  await expect(
    page.getByRole("button", { name: "Esci", exact: true }),
  ).toBeVisible();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(
    `/commissions?brand_id=${brandId}&from=2032-01-01&to=2032-02-28`,
  );
  const summary = page.getByRole("region", {
    name: "Totale del periodo",
    exact: true,
  });
  await expect(summary).toContainText("30,00");
  await expect(summary).toContainText("3,20");
  const orders = page.getByRole("region", { name: "Ordini", exact: true });
  await expect(orders).toContainText("12,25%");
  await expect(orders).toContainText("Percentuale brand");
  await expect(orders).toContainText("Percentuale ordine");
  for (const theme of ["Chiaro", "Scuro"]) {
    if (theme === "Chiaro")
      await page
        .locator("summary")
        .filter({ hasText: "Preferenze utente" })
        .click();
    await page.getByRole("button", { name: theme, exact: true }).click();
    expect(
      (await new AxeBuilder({ page }).analyze()).violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Esporta Excel", exact: true }).click(),
  ]);
  const target = info.outputPath("provvigioni.xlsx");
  await download.saveAs(target);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(new Uint8Array(readFileSync(target)).buffer);
  const brandRow = book.getWorksheet("Riepilogo per brand")!.getRow(2);
  expect(brandRow.getCell(1).value).toBe(`'${name}`);
  expect(brandRow.getCell(4).value).toBe("3000");
  expect(brandRow.getCell(5).value).toBe("320");
  const detail = book.getWorksheet("Ordini")!;
  expect(detail.rowCount).toBe(3);
  expect(detail.getRow(2).getCell(9).value).toBe("245");
  expect(detail.getRow(3).getCell(9).value).toBe("75");
  expect(JSON.stringify(book.model)).not.toContain("Secret commission note");
  await expect(
    page.getByRole("status").filter({ hasText: "File pronto" }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("commissions.png"),
    fullPage: true,
  });
  const response = await page.request.get(
    `/api/commissions/export?brand_id=${brandId}`,
  );
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  const csv = await page.request.get(
    `/api/commissions/export?brand_id=${brandId}&format=csv`,
  );
  expect(csv.status()).toBe(200);
  const csvText = await csv.text();
  expect(csvText).toContain("245");
  expect(csvText).toContain("75");
  expect(csvText).toContain(`'${name}`);
  expect(csvText).not.toContain("Secret commission note");
  const [csvDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Esporta CSV", exact: true }).click(),
  ]);
  expect(csvDownload.suggestedFilename()).toBe("provvigioni.csv");
  await page.getByLabel("Al", { exact: true }).fill("2032-01-31");
  await page
    .getByRole("button", { name: "Applica filtri", exact: true })
    .click();
  await expect(summary).toContainText("0,75");
  await page.goto(
    `/commissions?brand_id=${brandId}&from=2035-01-01&to=2035-01-31`,
  );
  await expect(
    page.getByRole("heading", { name: "Nessuna provvigione", exact: true }),
  ).toBeVisible();
  const invalid = await page.request.get(
    "/api/commissions/export?from=invalid",
  );
  expect(invalid.status()).toBe(400);
  expect(errors).toEqual([]);
});
