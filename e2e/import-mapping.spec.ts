import { setAppearance } from "./helpers/account";
import { completeAdminMfa } from "./helpers/mfa";
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
const password = "Mapping-local-fixture-42";
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
  email = `mapping-${crypto.randomUUID()}@example.test`;
  const result = await db().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (result.error) throw result.error;
  userId = result.data.user!.id;
  const updated = await db()
    .from("profiles")
    .update({ role: "admin", full_name: "Mappatura di prova" })
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
  await client.from("import_profiles").delete().eq("created_by", userId);
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
test("three sheets, profile persistence, deliberate errors and bounded staging", async ({
  page,
}, info) => {
  await login(page);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/imports/operational");
  await page
    .getByRole("main")
    .locator("input[type=file]")
    .setInputFiles(".fixtures/imports/synthetic-import.xlsx");
  const stores = page.getByRole("region", {
    name: "Mappatura del foglio Negozi",
  });
  await expect(
    stores.getByRole("combobox", { name: "Ragione sociale", exact: true }),
  ).toHaveValue("1");
  await stores
    .getByRole("textbox", { name: "Nome del profilo", exact: true })
    .fill(`Negozi ${info.project.name}`);
  await stores
    .getByRole("button", { name: "Salva profilo", exact: true })
    .click();
  await expect(
    stores.getByRole("status").filter({ hasText: "salvato." }),
  ).toBeVisible();
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(await overflow()).toBe(false);

  for (const theme of ["Chiaro", "Scuro"]) {
    await setAppearance(page, theme);
    await expect(page.locator("html")).toHaveAttribute(
      "data-theme",
      theme === "Scuro" ? "dark" : "light",
    );
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
  await page
    .getByRole("button", { name: "Verifica righe", exact: true })
    .click();
  const preview = page.getByRole("region", {
    name: "Anteprima delle righe",
    exact: true,
  });
  await expect(preview.locator(".report-metrics .sr-only")).toHaveText([
    "3",
    "0",
    "2",
    "0",
  ]);
  await expect(
    page.getByRole("heading", { name: "Anteprima delle righe", exact: true }),
  ).toBeFocused();
  await preview
    .getByRole("combobox", { name: "Mostra righe", exact: true })
    .selectOption("error");
  await expect(
    preview
      .getByText(
        "Email: Valore non valido. Correggi la cella nel file e ricaricalo.",
        { exact: true },
      )
      .filter({ visible: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Scarica segnalazioni CSV", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe(
    "controlli-importazione.csv",
  );
  await page
    .getByRole("button", { name: "Prepara gli abbinamenti", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Righe preparate. Puoi verificare gli abbinamenti." })
      .last(),
  ).toBeVisible();
  const batch = (
    await db()
      .from("import_batches")
      .select("id,options")
      .eq("created_by", userId)
      .single()
  ).data!;
  const rows = await db()
    .from("import_rows")
    .select("sheet,row_number,status,mapped")
    .eq("batch_id", batch.id);
  expect(rows.data?.length).toBe(5);
  expect(rows.data?.filter((r) => r.status === "error").length).toBe(2);
  expect(
    rows.data?.find((r) => r.sheet === "Ordini" && r.row_number === 2)?.mapped,
  ).toMatchObject({
    unit_price_cents: 123456,
    quantity: 2,
    line_discount_pct: 10,
  });
  expect(errors).toEqual([]);
  expect(await overflow()).toBe(false);
  await page.goto("/imports/operational");
  await page
    .getByRole("main")
    .locator("input[type=file]")
    .setInputFiles(".fixtures/imports/synthetic-import.xlsx");
  await expect(
    page
      .getByRole("region", { name: "Mappatura del foglio Negozi" })
      .getByRole("combobox", { name: "Profilo salvato", exact: true })
      .locator("option")
      .filter({ hasText: `Negozi ${info.project.name}` }),
  ).toHaveCount(1);
});
