import { completeAdminMfa } from "./helpers/mfa";
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { selectChoice } from "./helpers/navigation";
import ExcelJS from "exceljs";
const password = "Imports-local-fixture-42";
let email: string, userId: string;
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
  email = `import-${crypto.randomUUID()}@example.test`;
  const created = await db().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  userId = created.data.user!.id;
  const updated = await db()
    .from("profiles")
    .update({ role: "admin", full_name: "Importazioni di prova" })
    .eq("id", userId);
  if (updated.error) throw updated.error;
});
test.afterAll(async () => {
  if (!userId) return;
  const client = db(),
    batches = await client
      .from("import_batches")
      .select("id,storage_path")
      .eq("created_by", userId);
  for (const b of batches.data ?? []) {
    await client.storage.from("imports").remove([b.storage_path]);
    await client.from("import_rows").delete().eq("batch_id", b.id);
    await client.from("import_batches").delete().eq("id", b.id);
  }
  await client.auth.admin.deleteUser(userId);
});
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await completeAdminMfa(page);
  await expect(
    page.getByRole("button", { name: "Esci", exact: true }),
  ).toBeVisible();
}
async function choose(page: Page) {
  await page.goto("/imports/new");
  await page
    .getByRole("main")
    .locator('input[type="file"]')
    .setInputFiles(".fixtures/imports/synthetic-performance.xlsx");
  await expect(
    page.getByRole("button", { name: "Salva dati storici", exact: true }),
  ).toBeEnabled();
}
test("historical preview, persistence, filters, duplicates and rollback", async ({
  page,
}, info) => {
  await login(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/imports/new");
  await page
    .getByRole("main")
    .locator('input[type="file"]')
    .setInputFiles({
      name: "invalid.xlsm",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("invalid"),
    });
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Macro e collegamenti esterni non sono ammessi" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Scegli un altro file", exact: true })
    .click();
  await page
    .getByRole("main")
    .locator('input[type="file"]')
    .setInputFiles({
      name: "too-large.xlsx",
      mimeType: "application/octet-stream",
      buffer: Buffer.alloc(10485761),
    });
  await expect(
    page.getByRole("alert").filter({ hasText: "Il file supera i limiti" }),
  ).toBeVisible();
  await choose(page);
  const money = page.locator(".report-metrics .sr-only");
  await expect(money).toHaveText([
    "120,25 €",
    "230,00 €",
    "190,50 €",
    "350,00 €",
    "310,75 €",
  ]);
  await expect(
    page.getByRole("alert").filter({ hasText: "I totali differiscono" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Salva dati storici", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Annulla", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Conferma e salva", exact: true })
    .click();
  await expect(page).toHaveURL(/\/analysis\?batch=[a-f0-9-]+&imported=1$/);
  const batchId = new URL(page.url()).searchParams.get("batch")!;
  await expect(
    page.getByRole("status").filter({ hasText: "Importazione completata" }),
  ).toBeVisible();
  await expect(money).toHaveText([
    "120,25 €",
    "230,00 €",
    "190,50 €",
    "350,00 €",
    "310,75 €",
  ]);
  await page.reload();
  await expect(money.first()).toHaveText("120,25 €");
  await selectChoice(page, "Perimetro brand", "Tutti i brand del file");
  await selectChoice(page, "Raggruppa per", "Area");
  await page
    .getByRole("button", { name: "Applica filtri", exact: true })
    .click();
  await expect(page).toHaveURL(/scope=all/);
  await expect(money.first()).toHaveText("1119,25 €");
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Raggruppa per", exact: true }),
  ).toHaveValue("area");
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
    await page.screenshot({
      path: info.outputPath(`analysis-${theme}.png`),
      fullPage: true,
    });
  }
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Scarica Excel", exact: true })
    .click();
  const download = await downloadPromise,
    book = new ExcelJS.Workbook();
  await book.xlsx.readFile((await download.path())!);
  expect(book.getWorksheet("Dati aggregati")?.rowCount).toBe(3);
  expect(book.getWorksheet("Riepilogo stagioni")?.getCell("B2").value).toBe(
    "1119,25 €",
  );
  const csv = await page.request.get(
    `/api/imports/export?${new URL(page.url()).searchParams}&format=csv`,
  );
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain("EUROPE");
  const original = await page.request.get(`/api/imports/${batchId}`);
  expect(original.status()).toBe(200);
  expect(await original.body()).toEqual(
    readFileSync(".fixtures/imports/synthetic-performance.xlsx"),
  );
  await choose(page);
  await page
    .getByRole("button", { name: "Salva dati storici", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Conferma e salva", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Questo file è già stato caricato" }),
  ).toBeVisible();
  expect(
    (await db().from("import_batches").select("id").eq("created_by", userId))
      .data,
  ).toHaveLength(1);
  await page.goto("/imports");
  await page
    .getByRole("button", { name: "Annulla importazione", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Annulla", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Conferma annullamento", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await db()
            .from("import_batches")
            .select("status")
            .eq("id", batchId)
            .single()
        ).data?.status,
    )
    .toBe("rolled_back");
  await page.goto(`/analysis?batch=${batchId}`);
  await expect(
    page.getByRole("alert").filter({ hasText: "Impossibile caricare" }),
  ).toBeVisible();
  await db().from("profiles").update({ role: "staff" }).eq("id", userId);
  await page.goto("/imports/new");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("404");
  const rejected = await page.request.post("/api/imports/upload", {
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(rejected.status()).toBe(403);
  expect((await page.request.get(`/api/imports/${batchId}`)).status()).toBe(
    403,
  );
  expect(
    (await page.request.get(`/api/imports/export?batch=${batchId}`)).status(),
  ).toBe(403);
  expect(errors).toEqual([]);
});
test("read-only verification of an operator supplied workbook", async ({
  page,
}, info) => {
  test.skip(
    !process.env.IMPORT_READONLY_SOURCE || info.project.name !== "desktop",
    "Optional local source, never committed or saved",
  );
  await login(page);
  await page.goto("/imports/new");
  const before = (
    await db().from("import_batches").select("id").eq("created_by", userId)
  ).data;
  await page
    .getByRole("main")
    .locator('input[type="file"]')
    .setInputFiles(process.env.IMPORT_READONLY_SOURCE!);
  await expect(
    page.getByRole("button", { name: "Salva dati storici", exact: true }),
  ).toBeEnabled();
  const expected = JSON.parse(
    readFileSync(process.env.IMPORT_READONLY_EXPECTED!, "utf8"),
  );
  await expect(page.locator(".report-metrics .sr-only")).toHaveText(
    expected.totals,
  );
  await expect(
    page.getByText(`Il file contiene ${expected.rows} righe.`, {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Segnalazioni nel file" }),
  ).toContainText(String(expected.warnings));
  await expect(
    page.getByRole("alert").filter({ hasText: "I totali differiscono" }),
  ).toHaveCount(0);
  expect(
    (await db().from("import_batches").select("id").eq("created_by", userId))
      .data,
  ).toEqual(before);
});
