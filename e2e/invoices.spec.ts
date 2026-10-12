import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { signMockWebhook } from "../lib/invoicing/webhook";
const password = "Invoices-local-fixture-42",
  name = `Fatture ${crypto.randomUUID()}`;
let email: string,
  userId: string,
  brandId: string,
  customerId: string,
  seasonId: string,
  productId: string,
  orderId: string,
  cancelOrderId: string;
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
  email = `invoices-${crypto.randomUUID()}@example.test`;
  const created = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (created.error) throw created.error;
  userId = created.data.user!.id;
  await db.from("profiles").update({ role: "staff" }).eq("id", userId);
  brandId = (
    await db
      .from("brands")
      .insert({ name, legal_name: `Emittente ${name}` })
      .select("id")
      .single()
  ).data!.id;
  await db.from("brand_private").insert({
    id: brandId,
    vat_number: "12345678901",
    address: "Via prova 1",
    city: "Roma",
  });
  customerId = (
    await db
      .from("customers")
      .insert({
        legal_name: `Cliente ${name}`,
        vat_number: "12345678901",
        billing_address: {
          street: "Via negozio 1",
          postal_code: "00100",
          city: "Roma",
          province: "RM",
          country: "IT",
        },
      })
      .select("id")
      .single()
  ).data!.id;
  seasonId = (
    await db
      .from("seasons")
      .insert({ brand_id: brandId, code: "INVOICES", name })
      .select("id")
      .single()
  ).data!.id;
  productId = (
    await db
      .from("products")
      .insert({
        brand_id: brandId,
        season_id: seasonId,
        sku_base: name,
        name: "Camicia di prova",
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
  for (let index = 0; index < 2; index++) {
    const order = await session.rpc("save_order", {
      p_id: null as unknown as string,
      p_data: {
        brand_id: brandId,
        customer_id: customerId,
        season_id: seasonId,
        order_date: "2033-01-01",
        discount_pct: 0,
        payment_terms: "30 giorni",
        internal_notes: "Secret invoice order note",
      },
      p_lines: [
        {
          variant_id: variant,
          quantity: 2,
          unit_price_cents: 1000,
          discount_pct: 0,
        },
      ],
    });
    if (order.error) throw order.error;
    const createdOrderId = order.data!;
    if (index === 0) orderId = createdOrderId;
    else cancelOrderId = createdOrderId;
    for (const status of [
      "confirmed",
      "in_production",
      "shipped",
      "delivered",
    ] as const) {
      const result = await session.rpc("change_order_status", {
        p_id: createdOrderId,
        p_status: status,
        p_note: "",
      });
      if (result.error) throw result.error;
    }
  }
  await db.from("profiles").update({ role: "accounting" }).eq("id", userId);
});
test.afterAll(async () => {
  if (brandId) {
    const file = `/tmp/mdc-invoices-cleanup-${brandId}.sql`;
    // Only the isolated synthetic fixture. Trigger changes stay inside this transaction and its table locks.
    // Only synthetic history is removed; both guards are restored before commit.
    writeFileSync(
      file,
      `do $$ begin
  alter table public.invoices disable trigger invoices_snapshot_guard;
  alter table public.payments disable trigger payments_immutable;
  delete from public.invoice_webhook_events where brand_id='${brandId}';
  delete from public.mock_invoice_records where brand_id='${brandId}';
  delete from public.payments where brand_id='${brandId}';
  delete from public.invoices where brand_id='${brandId}';
  delete from public.invoice_counters where brand_id='${brandId}';
  delete from public.order_status_history where brand_id='${brandId}';
  delete from public.order_private where brand_id='${brandId}';
  delete from public.order_lines where brand_id='${brandId}';
  delete from public.orders where brand_id='${brandId}';
  delete from public.product_variants where brand_id='${brandId}';
  delete from public.products where brand_id='${brandId}';
  delete from public.seasons where brand_id='${brandId}';
  delete from public.brand_private where id='${brandId}';
  delete from public.brands where id='${brandId}';
  delete from public.customers where id='${customerId}';
  alter table public.payments enable trigger payments_immutable;
  alter table public.invoices enable trigger invoices_snapshot_guard;
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
  }
  if (userId) await admin().auth.admin.deleteUser(userId);
});
test("delivered order to simulated invoice, signed webhook and two payments", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto(`/orders/${orderId}`);
  await expect(
    page.getByRole("button", { name: "Genera fattura", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Data emissione", { exact: true }).fill("2033-01-01");
  await page.getByLabel("Data scadenza", { exact: true }).fill("2032-01-01");
  await page
    .getByRole("button", { name: "Genera fattura", exact: true })
    .click();
  await expect(page.getByLabel("Data scadenza", { exact: true })).toBeFocused();
  await page.getByLabel("Data scadenza", { exact: true }).fill("2033-02-01");
  await page
    .getByRole("button", { name: "Genera fattura", exact: true })
    .click();
  await expect(page).toHaveURL(/\/invoices\/[a-f0-9-]+$/);
  const invoiceId = page.url().split("/").at(-1)!;
  const db = admin();
  const invoice = (
    await db
      .from("invoices")
      .select("external_id,status")
      .eq("id", invoiceId)
      .single()
  ).data!;
  expect(invoice.status).toBe("issued");
  expect(
    (await db.from("orders").select("status").eq("id", orderId).single()).data
      ?.status,
  ).toBe("invoiced");
  await expect(
    page.getByRole("heading", { name: /Fattura F-2033/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Nessun pagamento registrato.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("#content")).toContainText("24,40");
  await expect(page.locator("#content")).toContainText("Fattura simulata");
  for (const theme of ["Chiaro", "Scuro"]) {
    if (theme === "Chiaro")
      await page
        .locator("summary")
        .filter({ hasText: "Preferenze utente" })
        .click();
    await page.getByRole("button", { name: theme, exact: true }).click();
    await page.waitForTimeout(400);
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
  await page.screenshot({
    path: info.outputPath("invoice-unpaid.png"),
    fullPage: true,
  });
  await db
    .from("customers")
    .update({ legal_name: "Anagrafica modificata dopo emissione" })
    .eq("id", customerId);
  await page.reload();
  await expect(page.locator("#content")).toContainText(`Cliente ${name}`);
  await expect(page.locator("#content")).not.toContainText(
    "Anagrafica modificata",
  );
  const body = JSON.stringify({
      eventId: crypto.randomUUID(),
      externalId: invoice.external_id,
      status: "sent",
    }),
    timestamp = String(Math.floor(Date.now() / 1000));
  const headers = {
    "x-invoicing-timestamp": timestamp,
    "x-invoicing-signature": await signMockWebhook(
      body,
      timestamp,
      process.env.INVOICING_WEBHOOK_SECRET!,
    ),
  };
  const callback = await page.request.post("/api/webhooks/invoicing", {
    data: body,
    headers,
  });
  expect(callback.status()).toBe(200);
  expect(await callback.json()).toEqual({ received: true, applied: true });
  expect(
    (
      await page.request.post("/api/webhooks/invoicing", {
        data: body,
        headers,
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.post("/api/webhooks/invoicing", { data: body })
    ).status(),
  ).toBe(401);
  await page
    .getByRole("button", { name: "Aggiorna stato", exact: true })
    .click();
  await expect(
    page.getByText("Inviata", { exact: true }).first(),
  ).toBeVisible();
  await page.getByLabel("Importo ricevuto (€)", { exact: true }).fill("30");
  await page
    .getByRole("button", { name: "Registra pagamento", exact: true })
    .click();
  await expect(
    page.getByLabel("Importo ricevuto (€)", { exact: true }),
  ).toBeFocused();
  await expect(
    page
      .getByText("L’importo supera il saldo da incassare.", { exact: true })
      .first(),
  ).toBeVisible();
  await page.getByLabel("Importo ricevuto (€)", { exact: true }).fill("10,00");
  await page
    .getByRole("button", { name: "Registra pagamento", exact: true })
    .click();
  await expect(
    page.getByText("Pagamento registrato. Il saldo è aggiornato.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("#content")).toContainText("14,40");
  expect(
    (
      await db
        .from("payments")
        .select("amount_cents")
        .eq("invoice_id", invoiceId)
    ).data,
  ).toHaveLength(1);
  await page.getByLabel("Importo ricevuto (€)", { exact: true }).fill("14,40");
  await page
    .getByRole("button", { name: "Registra pagamento", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Registra pagamento", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Pagata", { exact: true }).first()).toBeVisible();
  expect(
    (
      await db
        .from("payments")
        .select("amount_cents")
        .eq("invoice_id", invoiceId)
    ).data
      ?.map((p) => p.amount_cents)
      .sort((a, b) => a - b),
  ).toEqual([1000, 1440]);
  await page.screenshot({
    path: info.outputPath("invoice-paid.png"),
    fullPage: true,
  });
  await page.goto(`/invoices?q=${encodeURIComponent("F-2033/")}`);
  await expect(
    page.getByRole("heading", { name: "Fatture e incassi" }),
  ).toBeVisible();
  await expect(page.locator("#content")).toContainText("24,40");
  expect(
    (await new AxeBuilder({ page }).analyze()).violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await page.goto(
    `/dashboard?brand_id=${brandId}&from=2033-01-01&to=2033-01-31`,
  );
  await expect(
    page.getByRole("region", { name: "Riepilogo", exact: true }),
  ).toContainText("20,00");
  await page.goto(`/orders/${cancelOrderId}`);
  await page.getByLabel("Data emissione", { exact: true }).fill("2033-01-01");
  await page.getByLabel("Data scadenza", { exact: true }).fill("2033-02-01");
  await page
    .getByRole("button", { name: "Genera fattura", exact: true })
    .click();
  await expect(page).toHaveURL(/\/invoices\/[a-f0-9-]+$/);
  await page
    .getByRole("button", { name: "Annulla fattura", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Annulla fattura" });
  await expect(
    dialog.getByRole("button", { name: "Annulla", exact: true }),
  ).toBeFocused();
  await dialog
    .getByRole("button", { name: "Annulla fattura", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByText("Fattura annullata.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Registra pagamento", exact: true }),
  ).toHaveCount(0);
  await db.from("profiles").update({ role: "staff" }).eq("id", userId);
  await page.goto(`/invoices/${invoiceId}`);
  await expect(
    page.getByRole("button", { name: "Aggiorna stato", exact: true }),
  ).toHaveCount(0);
  await db.from("profiles").update({ role: "brand" }).eq("id", userId);
  await page.goto("/invoices");
  await expect(page).toHaveURL(/\/portal\/dashboard/);
  expect(errors).toEqual([]);
});
