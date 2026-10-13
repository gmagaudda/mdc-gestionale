import { completeAdminMfa } from "./helpers/mfa";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
const db = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
let userId: string, email: string;
const password = "Capacity-local-fixture-42";
test.beforeAll(async () => {
  if (
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
    )
  )
    throw Error("Local fixtures only");
  email = `capacity-${crypto.randomUUID()}@example.test`;
  const result = await db().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (result.error) throw result.error;
  userId = result.data.user!.id;
  const updated = await db()
    .from("profiles")
    .update({ role: "admin" })
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
test("20,000 physical rows are validated and staged within one minute", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Capacity gate on desktop. Responsive flow has a separate five-viewport test.",
  );
  test.setTimeout(120000);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await completeAdminMfa(page);
  await expect(
    page.getByRole("button", { name: "Esci", exact: true }),
  ).toBeVisible();
  await page.goto("/imports/operational");
  const csv = [
    "Codice negozio;Ragione sociale;Città;Paese",
    ...Array.from(
      { length: 19999 },
      (_, i) => `CAP-${i};Negozio sintetico ${i};Milano;IT`,
    ),
  ].join("\n");
  await page
    .getByRole("main")
    .locator("input[type=file]")
    .setInputFiles({
      name: "capacity.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await expect(
    page.getByRole("button", { name: "Verifica righe", exact: true }),
  ).toBeVisible();
  const started = performance.now();
  await page
    .getByRole("button", { name: "Verifica righe", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Prepara gli abbinamenti", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Abbinamenti", exact: true }),
  ).toBeVisible({ timeout: 65000 });
  const elapsed = performance.now() - started;
  const batch = (
    await db()
      .from("import_batches")
      .select("id")
      .eq("created_by", userId)
      .single()
  ).data!;
  const rows = await db()
    .from("import_rows")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batch.id)
    .eq("status", "valid");
  expect(rows.count).toBe(19999);
  expect(elapsed).toBeLessThan(60000);
  await info.attach("capacity.json", {
    body: JSON.stringify({
      physicalRows: 20000,
      dataRows: 19999,
      validationAndStagingMs: Math.round(elapsed),
    }),
    contentType: "application/json",
  });
});
