import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
const password = "Local-customers-test-42";
const ids: string[] = [];
const customers: string[] = [];
let staffEmail: string;
let accountingEmail: string;
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
  for (const role of ["staff", "accounting"] as const) {
    const email = `customers-${role}-${crypto.randomUUID()}@example.test`;
    const result = await db().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (!result.data.user) throw Error("Fixture creation failed");
    ids.push(result.data.user.id);
    await db().from("profiles").update({ role }).eq("id", result.data.user.id);
    if (role === "staff") staffEmail = email;
    else accountingEmail = email;
  }
});
test.afterAll(async () => {
  for (const id of customers) {
    await db().from("customer_contacts").delete().eq("customer_id", id);
    await db().from("customers").delete().eq("id", id);
  }
  for (const id of ids) await db().auth.admin.deleteUser(id);
});
test("staff validates creates edits and archives a customer", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(staffEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("link", { name: "Clienti", exact: true }).click();
  await page.getByRole("link", { name: "Nuovo cliente" }).click();
  await page
    .getByLabel("Ragione sociale", { exact: true })
    .fill("Boutique di prova");
  await page.getByLabel("Partita IVA (11 cifre)").fill("123");
  await page
    .getByRole("button", { name: "Salva cliente", exact: true })
    .click();
  await expect(page.getByLabel("Partita IVA (11 cifre)")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Partita IVA (11 cifre)")).toBeFocused();
  await page.getByLabel("Partita IVA (11 cifre)").fill("01234567890");
  await page.getByLabel("Codice SDI (7 caratteri)").fill("ABC1234");
  await page
    .getByRole("group", { name: "Indirizzo di fatturazione", exact: true })
    .getByLabel("Città", { exact: true })
    .fill("Milano");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("button", { name: "Salva cliente", exact: true })
    .click();
  await expect(page).toHaveURL(/\/customers\/[\w-]+\?saved=1/);
  const id = new URL(page.url()).pathname.split("/").pop()!;
  customers.push(id);
  await expect(
    page.getByRole("heading", { name: "Boutique di prova" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Modifica cliente" }).click();
  await page.getByLabel("Insegna", { exact: true }).fill("Nuova insegna");
  await page
    .getByRole("button", { name: "Salva cliente", exact: true })
    .click();
  await expect(page.getByText("Nuova insegna", { exact: true })).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Aggiungi referente" })
    .click();
  await page.getByLabel("Nome referente").fill("Buyer di prova");
  await page
    .getByRole("button", { name: "Aggiungi referente", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Buyer di prova" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Archivia cliente", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Conferma archiviazione", exact: true })
    .click();
  await expect(page).toHaveURL(/\/customers$/);
  await page.goto(`/customers/${id}`);
  await expect(page.getByText("404", { exact: true })).toBeVisible();
});
test("accounting reads customers and cannot create them", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(accountingEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/customers");
  await expect(
    page.getByRole("heading", { name: "Clienti", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Nuovo cliente" })).toHaveCount(
    0,
  );
  await page.goto("/customers/new");
  await expect(page.getByText("404", { exact: true })).toBeVisible();
});
