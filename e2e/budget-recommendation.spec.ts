import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import { selectChoice } from "./helpers/navigation";
const password = "Budget-suggestion-local-42";
const db = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
let email: string,
  userId: string,
  brandId: string,
  customerId: string,
  batchId: string;
const name = `Suggerimento ${crypto.randomUUID()}`;
test.beforeAll(async () => {
  if (
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
    )
  )
    throw Error("Local fixtures only");
  const admin = db();
  email = `suggestion-${crypto.randomUUID()}@example.test`;
  userId = (
    await admin.auth.admin.createUser({ email, password, email_confirm: true })
  ).data.user!.id;
  await admin.from("profiles").update({ role: "accounting" }).eq("id", userId);
  brandId = (await admin.from("brands").insert({ name }).select("id").single())
    .data!.id;
  customerId = (
    await admin
      .from("customers")
      .insert({ legal_name: name, city: "Roma" })
      .select("id")
      .single()
  ).data!.id;
  for (const code of ["SS28", "SS27", "SS26"]) {
    const r = await admin
      .from("seasons")
      .insert({ brand_id: brandId, code, name });
    if (r.error) throw r.error;
  }
  batchId = crypto.randomUUID();
  const b = await admin.from("import_batches").insert({
    id: batchId,
    kind: "performance",
    file_name: "storico-sintetico.xlsx",
    file_sha256: crypto.randomUUID().replaceAll("-", "").repeat(2),
    storage_path: `${batchId}.xlsx`,
    size_bytes: 100,
    status: "completed",
    created_by: userId,
    completed_at: new Date().toISOString(),
  });
  if (b.error) throw b.error;
  const r = await admin.from("import_rows").insert({
    batch_id: batchId,
    entity: "performance",
    sheet: "RECAP BUDGET",
    row_number: 2,
    raw: {},
    mapped: {
      brand: name,
      customer: name,
      city: "Roma",
      country: "IT",
      values: {
        orders_ss27: 1200000,
        orders_ss26: 1000000,
        orders_fw26: 0,
        budget_ss27: null,
        budget_fw26: null,
      },
    },
    status: "imported",
  });
  if (r.error) throw r.error;
});
test.afterAll(async () => {
  const admin = db();
  await admin.from("budget_private").delete().eq("brand_id", brandId);
  await admin.from("budgets").delete().eq("brand_id", brandId);
  await admin.from("import_rows").delete().eq("batch_id", batchId);
  await admin.from("import_batches").delete().eq("id", batchId);
  await admin.from("seasons").delete().eq("brand_id", brandId);
  await admin.from("customers").delete().eq("id", customerId);
  await admin.from("brands").delete().eq("id", brandId);
  await admin.auth.admin.deleteUser(userId);
});
async function treatment(
  page: Page,
  code: string,
  state: string,
  reason: string,
) {
  await page
    .getByRole("combobox", { name: `Trattamento ${code}`, exact: true })
    .selectOption(state);
  await page
    .getByRole("textbox", { name: `Motivazione ${code}`, exact: true })
    .fill(reason);
}
async function open(page: Page, text: string) {
  const summary = page
    .locator("summary")
    .filter({ hasText: new RegExp(`^${text}$`) });
  if (
    !(await summary.evaluate(
      (el) => (el.parentElement as HTMLDetailsElement).open,
    ))
  )
    await summary.click();
}
test("suggests homologous seasons handles exceptions and preserves adjustment provenance", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Esci", exact: true }),
  ).toBeVisible();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/budgets/new");
  for (const [label, result] of [
    ["Brand", name],
    ["Stagione (facoltativa)", `SS28 · ${name}`],
    ["Cliente (facoltativo)", `${name} · Roma`],
  ]) {
    await page.getByRole("combobox", { name: label, exact: true }).fill(name);
    await expect(
      page.getByRole("combobox", { name: label, exact: true }),
    ).toBeEnabled();
    await selectChoice(page, label, result);
  }
  const calculate = page.getByRole("button", {
    name: "Calcola suggerimento",
    exact: true,
  });
  expect((await calculate.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await calculate.focus();
  await calculate.press("Enter");
  const panel = page.locator("section").filter({
    has: page.getByRole("heading", {
      name: "Suggerimento per la prossima stagione",
      exact: true,
    }),
  });
  await expect(
    panel.getByText("Non calcolabile", { exact: true }),
  ).toBeVisible();
  await open(page, "Verifica le stagioni e le eccezioni");
  for (const code of ["SS27", "SS26", "FW27", "FW26"]) {
    await open(page, `Verifica ${code}`);
    await treatment(
      page,
      code,
      code.startsWith("SS") ? "closed" : "zero",
      "Stagione conclusa verificata",
    );
  }
  await page
    .getByRole("button", { name: "Ricalcola suggerimento", exact: true })
    .click();
  await expect(
    panel.locator("dl").getByText("Prevalentemente estivo", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Usa importo suggerito", exact: true })
    .click();
  await expect(page.getByLabel("Importo netto", { exact: true })).toHaveValue(
    "11250,00",
  );
  await open(page, "Verifica le stagioni e le eccezioni");
  await open(page, "Verifica SS27");
  await treatment(
    page,
    "SS27",
    "excluded",
    "Chiusura straordinaria del negozio",
  );
  await expect(
    page.getByRole("button", { name: "Usa importo suggerito", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Salva budget", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Il suggerimento non è più aggiornato" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ricalcola suggerimento", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Usa importo suggerito", exact: true })
    .click();
  await expect(page.getByLabel("Importo netto", { exact: true })).toHaveValue(
    "10000,00",
  );
  await treatment(page, "SS27", "closed", "Stagione conclusa verificata");
  await page
    .getByRole("button", { name: "Ricalcola suggerimento", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Usa importo suggerito", exact: true })
    .click();
  for (const theme of ["Chiaro", "Scuro"]) {
    await open(page, "Preferenze utente");
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
  await page
    .locator("summary")
    .filter({ hasText: /^Preferenze utente$/ })
    .click();
  await page.screenshot({
    path: info.outputPath("recommendation.png"),
    fullPage: true,
  });
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 320, height: 844 });
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(320);
  const target = page.getByRole("button", {
    name: "Ricalcola suggerimento",
    exact: true,
  });
  await target.scrollIntoViewIfNeeded();
  expect(
    await target.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(
        document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
      );
    }),
  ).toBe(true);
  await page.evaluate(() => (document.documentElement.style.fontSize = ""));
  await page.setViewportSize(viewport);
  await page.getByLabel("Importo netto", { exact: true }).fill("12000,00");
  await page.getByLabel("Inizio periodo", { exact: true }).fill("2028-01-01");
  await page.getByLabel("Fine periodo", { exact: true }).fill("2028-06-30");
  await page.getByRole("button", { name: "Salva budget", exact: true }).click();
  await expect(
    page.getByLabel("Motivo della modifica al budget suggerito", {
      exact: true,
    }),
  ).toBeFocused();
  await page
    .getByLabel("Motivo della modifica al budget suggerito", { exact: true })
    .fill("Crescita concordata con il cliente");
  await page.getByRole("button", { name: "Salva budget", exact: true }).click();
  await expect(page).toHaveURL(/\/budgets\/[a-f0-9-]+\?saved=1$/);
  await expect(
    page.getByRole("heading", {
      name: "Origine del budget suggerito",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Motivo della modifica: Crescita concordata con il cliente",
      { exact: true },
    ),
  ).toBeVisible();
  const row = await db()
    .from("budgets")
    .select("amount_cents")
    .eq("brand_id", brandId)
    .single();
  expect(row.data?.amount_cents).toBe(1200000);
  expect(errors).toEqual([]);
});
