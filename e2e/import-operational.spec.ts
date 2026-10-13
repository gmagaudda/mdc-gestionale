import { setAppearance } from "./helpers/account";
import { completeAdminMfa } from "./helpers/mfa";
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import ExcelJS from "exceljs";
import AxeBuilder from "@axe-core/playwright";
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
const password = "Operational-local-fixture-42";
let email: string,
  userId: string,
  brandId: string,
  seasonId: string,
  budgetSeasonId: string,
  productId: string,
  variantId: string,
  source: Buffer,
  brand: string,
  code: string;
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
  const suffix = crypto.randomUUID().slice(0, 8);
  email = `operational-${suffix}@example.test`;
  brand = `Brand import ${suffix}`;
  code = `IMPORT-${suffix}`;
  const created = await db().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  userId = created.data.user!.id;
  await db()
    .from("profiles")
    .update({ role: "admin", full_name: "Import operativo di prova" })
    .eq("id", userId);
  brandId = crypto.randomUUID();
  seasonId = crypto.randomUUID();
  budgetSeasonId = crypto.randomUUID();
  productId = crypto.randomUUID();
  variantId = crypto.randomUUID();
  for (const result of [
    await db().from("brands").insert({ id: brandId, name: brand }),
    await db()
      .from("seasons")
      .insert([
        { id: seasonId, brand_id: brandId, code: "SS27", name: "SS27" },
        { id: budgetSeasonId, brand_id: brandId, code: "FW27", name: "FW27" },
      ]),
    await db().from("products").insert({
      id: productId,
      brand_id: brandId,
      season_id: seasonId,
      sku_base: code,
      name: "Articolo sintetico",
      wholesale_price_cents: 123456,
      vat_rate: 22,
    }),
    await db().from("product_variants").insert({
      id: variantId,
      product_id: productId,
      brand_id: brandId,
      sku: code,
      size: "M",
      color: "Nero",
    }),
  ])
    if (result.error) throw result.error;
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(".fixtures/imports/synthetic-import.xlsx");
  book.getWorksheet("Negozi")!.getCell("A2").value = `${code}-1`;
  book.getWorksheet("Negozi")!.getCell("B2").value = `Negozio import ${suffix}`;
  book.getWorksheet("Negozi")!.getCell("A3").value = `${code}-2`;
  for (const row of [2, 3]) {
    const sheet = book.getWorksheet("Ordini")!;
    sheet.getCell(`B${row}`).value = `${code}-${row - 1}`;
    sheet.getCell(`C${row}`).value = brand;
    sheet.getCell(`F${row}`).value = code;
  }
  const budget = book.getWorksheet("Budget")!;
  budget.getCell("A2").value = brand;
  budget.getCell("C2").value = `${code}-1`;
  source = Buffer.from(await book.xlsx.writeBuffer());
});
test.afterAll(async () => {
  if (!userId) return;
  const client = db(),
    batches = await client
      .from("import_batches")
      .select("id,storage_path")
      .eq("created_by", userId);
  for (const batch of batches.data ?? [])
    await client.storage.from("imports").remove([batch.storage_path]);
  const file = `/tmp/mdc-import-cleanup-${userId}.sql`;
  writeFileSync(
    file,
    `do $$ begin
    delete from app.import_changes where batch_id in(select id from public.import_batches where created_by='${userId}');
    delete from public.budget_private where brand_id='${brandId}';
    delete from public.budgets where brand_id='${brandId}';
    delete from public.order_status_history where brand_id='${brandId}';
    delete from public.order_private where brand_id='${brandId}';
    delete from public.order_lines where brand_id='${brandId}';
    delete from public.orders where brand_id='${brandId}';
    delete from public.product_variants where brand_id='${brandId}';
    delete from public.products where brand_id='${brandId}';
    delete from public.seasons where brand_id='${brandId}';
    delete from public.brands where id='${brandId}';
    delete from public.customer_contacts where customer_id in(select id from public.customers where import_batch_id in(select id from public.import_batches where created_by='${userId}'));
    delete from public.customers where import_batch_id in(select id from public.import_batches where created_by='${userId}');
    delete from public.import_rows where batch_id in(select id from public.import_batches where created_by='${userId}');
    delete from public.import_batches where created_by='${userId}';
    end $$;`,
  );
  try {
    execFileSync(
      "pnpm",
      ["exec", "supabase", "db", "query", "--local", "--file", file],
      { stdio: "pipe" },
    );
  } finally {
    rmSync(file, { force: true });
  }
  await client.auth.admin.deleteUser(userId);
});
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await completeAdminMfa(page);
  await expect(page.locator(".app-layout")).toBeVisible();
}
async function saveMatch(
  page: Page,
  label: string,
  value: string,
  create = false,
) {
  const region = page.getByRole("region", { name: label, exact: true });
  await region.getByRole("combobox").selectOption(value);
  await region
    .getByRole("button", { name: "Salva abbinamento", exact: true })
    .click();
  if (create) {
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: "Annulla", exact: true }),
    ).toBeFocused();
    await dialog
      .getByRole("button", { name: "Conferma creazione", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
  }
  await expect
    .poll(async () => {
      const batch = await db()
        .from("import_batches")
        .select("id")
        .eq("created_by", userId)
        .single();
      const rows = await db()
        .from("import_rows")
        .select("match")
        .eq("batch_id", batch.data!.id);
      return JSON.stringify(rows.data).includes(
        value.startsWith("existing:")
          ? value.slice(9)
          : value.startsWith("row:")
            ? value.slice(4)
            : "create",
      );
    })
    .toBe(true);
}
test("complete operational flow with review, exact totals, duplicate hash and rollback", async ({
  page,
}, testInfo) => {
  await login(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/imports/operational");
  await page.getByRole("main").locator("input[type=file]").setInputFiles({
    name: "synthetic-operation.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: source,
  });
  await page
    .getByRole("region", { name: "Mappatura del foglio Ordini" })
    .getByRole("combobox", {
      name: "Stato degli ordini importati",
      exact: true,
    })
    .selectOption("confirmed");
  await page
    .getByRole("button", { name: "Verifica righe", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Prepara gli abbinamenti", exact: true })
    .click();
  await page.getByRole("link", { name: "Abbinamenti", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Conferma importazione nel gestionale",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", {
      name: "Escludi le righe con errori mostrate",
      exact: true,
    })
    .click();
  const exclude = page.getByRole("dialog");
  await expect(
    exclude.getByRole("button", { name: "Annulla", exact: true }),
  ).toBeFocused();
  await exclude
    .getByRole("button", { name: "Conferma esclusione", exact: true })
    .click();
  await expect(exclude).not.toBeVisible();
  const batch = (
      await db()
        .from("import_batches")
        .select("id")
        .eq("created_by", userId)
        .single()
    ).data!.id,
    customer = (
      await db()
        .from("import_rows")
        .select("id,mapped")
        .eq("batch_id", batch)
        .eq("entity", "customers")
        .eq("status", "valid")
        .single()
    ).data!;
  const name = (customer.mapped as { legal_name: string }).legal_name;
  await saveMatch(
    page,
    `Negozio: ${code}-1 · ${name} · Milano · IT`,
    "create",
    true,
  );
  await saveMatch(page, `Negozio: ${code}-1`, `row:${customer.id}`);
  await saveMatch(page, `Brand: ${brand}`, `existing:${brandId}`);
  await saveMatch(page, `Stagione: ${brand} · SS27`, `existing:${seasonId}`);
  await saveMatch(
    page,
    `Stagione: ${brand} · FW27`,
    `existing:${budgetSeasonId}`,
  );
  await saveMatch(
    page,
    `Articolo: ${brand} · SS27 · ${code}`,
    `existing:${variantId}`,
  );
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Conferma importazione nel gestionale",
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByRole("textbox", { name: `Netto atteso: ${brand}`, exact: true })
    .fill("2.222,21");
  await page
    .getByRole("button", { name: "Salva totali attesi", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Totali attesi salvati." }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Conferma importazione nel gestionale",
      exact: true,
    })
    .click();
  const confirm = page.getByRole("dialog");
  await expect(
    confirm.getByRole("button", { name: "Annulla", exact: true }),
  ).toBeFocused();
  await confirm.getByRole("checkbox").check();
  await confirm
    .getByRole("button", { name: "Conferma e importa", exact: true })
    .click();
  await expect(confirm).not.toBeVisible();
  await expect(
    page.getByRole("status").filter({
      hasText:
        "Importazione completata. I dati sono disponibili nel gestionale.",
    }),
  ).toBeVisible();
  const order = (
    await db()
      .from("orders")
      .select("net_total_cents,gross_total_cents,status")
      .eq("import_batch_id", batch)
      .single()
  ).data!;
  expect(order).toMatchObject({
    net_total_cents: 222221,
    gross_total_cents: 271110,
    status: "confirmed",
  });
  const reportResponse = await page.request.get(
    `/api/imports/${batch}/export?format=csv`,
  );
  expect(reportResponse.status()).toBe(200);
  expect(await reportResponse.text()).toContain("5000,00");
  const xlsx = await page.request.get(`/api/imports/${batch}/export`);
  expect(xlsx.status()).toBe(200);
  expect(xlsx.headers()["cache-control"]).toBe("private, no-store");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(new Uint8Array(await xlsx.body()).buffer);
  expect(book.worksheets).toHaveLength(3);
  const duplicate = await page.request.post("/api/imports/upload", {
    headers: { Origin: new URL(page.url()).origin },
    multipart: {
      kind: "mixed",
      file: {
        name: "synthetic-operation.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: source,
      },
    },
  });
  expect(duplicate.status()).toBe(409);
  expect(await duplicate.json()).toMatchObject({
    error: "duplicateFile",
    id: batch,
    resume: false,
  });
  for (const theme of ["Chiaro", "Scuro"]) {
    await setAppearance(page, theme);

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
    await page.screenshot({
      path: testInfo.outputPath(`report-${theme}.png`),
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Annulla importazione", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Conferma annullamento", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("status").filter({
      hasText:
        "Importazione annullata. I dati creati sono archiviati e gli aggiornamenti ripristinati.",
    }),
  ).toBeVisible();
  expect(
    (
      await db()
        .from("orders")
        .select("deleted_at")
        .eq("import_batch_id", batch)
        .single()
    ).data?.deleted_at,
  ).toBeTruthy();
  const before = (
    await db().from("import_batches").select("stats").eq("id", batch).single()
  ).data!.stats;
  const otherExpired = await db()
    .from("import_batches")
    .select("id", { count: "exact", head: true })
    .is("file_removed_at", null)
    .lte("file_expires_at", new Date().toISOString());
  if (process.env.CRON_SECRET && otherExpired.count === 0) {
    expect((await page.request.post("/api/cron/imports")).status()).toBe(401);
    const expired = await db()
      .from("import_batches")
      .update({ file_expires_at: new Date(Date.now() - 10000).toISOString() })
      .eq("id", batch);
    expect(expired.error).toBeNull();
    expect(
      (
        await page.request.get(`/api/imports/${batch}`, { maxRedirects: 0 })
      ).status(),
    ).toBe(404);
    const cleaned = await page.request.post("/api/cron/imports", {
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    });
    expect(cleaned.status()).toBe(200);
    expect(await cleaned.json()).toMatchObject({ removed: 1, failed: 0 });
    const retained = (
      await db()
        .from("import_batches")
        .select("file_removed_at,stats,storage_path")
        .eq("id", batch)
        .single()
    ).data!;
    expect(retained.file_removed_at).toBeTruthy();
    expect(retained.stats).toEqual(before);
    expect(
      (await db().storage.from("imports").download(retained.storage_path))
        .error,
    ).toBeTruthy();
    await page.reload();
    await expect(
      page
        .getByText("File originale scaduto. Il report resta disponibile.", {
          exact: true,
        })
        .filter({ visible: true }),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
});
