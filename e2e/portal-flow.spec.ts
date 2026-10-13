import { setAppearance } from "./helpers/account";
import { completeAdminMfa } from "./helpers/mfa";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
const password = "Portal-flow-local-fixture-42",
  name = `Report ${crypto.randomUUID()}`;
let email: string,
  userId: string,
  brandId: string,
  seasonId: string,
  productId: string,
  customerId: string,
  foreignBrandId: string;
const orderIds: string[] = [],
  documentIds: string[] = [],
  paths: string[] = [];
let sharedEventId: string, hiddenEventId: string;
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
  await db
    .from("brands")
    .update({ can_see_customer_names: false })
    .eq("id", brandId);
  foreignBrandId = (
    await db
      .from("brands")
      .insert({ name: "Foreign portal brand" })
      .select("id")
      .single()
  ).data!.id;
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
      .insert({ legal_name: "Private portal customer", city: "Roma" })
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
        internal_notes: "Secret dashboard note",
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
    orderIds.push(order.data!);
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
    customer_id: customerId,
    amount_cents: 5000,
    period_start: "2032-01-01",
    period_end: "2032-02-28",
  });
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  for (const shared of [true, false]) {
    const event = await db
      .from("events")
      .insert({
        brand_id: brandId,
        title: shared ? "Evento condiviso portale" : "Evento interno nascosto",
        starts_at: `${today}T09:00:00Z`,
        ends_at: `${today}T10:00:00Z`,
        visible_to_brand: shared,
        assigned_to: userId,
        customer_id: customerId,
        description: "Descrizione condivisa",
        location: "Showroom",
      })
      .select("id")
      .single();
    if (event.error) throw event.error;
    if (shared) sharedEventId = event.data.id;
    else hiddenEventId = event.data.id;
    const bytes = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
        "base64",
      ),
      id = crypto.randomUUID(),
      path = `${brandId}/${id}.png`;
    const metadata = await db.from("documents").insert({
      id,
      brand_id: brandId,
      name: shared
        ? "Lookbook condiviso portale"
        : "Documento interno nascosto",
      kind: "lookbook",
      storage_path: path,
      original_filename: "lookbook.png",
      mime_type: "image/png",
      size_bytes: bytes.length,
      uploaded_by: userId,
      shared_with_brand: shared,
    });
    if (metadata.error) throw metadata.error;
    const upload = await db.storage
      .from("documents")
      .upload(path, bytes, { contentType: "image/png" });
    if (upload.error) throw upload.error;
    const ready = await db
      .from("documents")
      .update({ ready: true })
      .eq("id", id);
    if (ready.error) throw ready.error;
    documentIds.push(id);
    paths.push(path);
  }
  await db.from("profiles").update({ role: "brand" }).eq("id", userId);
  await db.from("brand_users").insert({ brand_id: brandId, user_id: userId });
  await session.auth.signOut();
});
test("brand reads orders sales documents calendar and private downloads", async ({
  page,
}, info) => {
  // This flow covers several routes, three downloads and both themes. Allow
  // the development server's first PDF compilation without racing its output.
  test.setTimeout(60000);
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await completeAdminMfa(page);
  await expect(page).toHaveURL(/portal/);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(
    `/portal/orders?brand_id=${brandId}&from=2032-01-01&to=2032-02-28`,
  );
  await expect(page.locator("#content")).toContainText("Cliente riservato");
  await expect(page.locator("#content")).not.toContainText(
    "Private portal customer",
  );
  await expect(page.getByText("Crea ordine", { exact: true })).toHaveCount(0);
  for (const key of [
    "number",
    "brand_name",
    "season_code",
    "customer_display_name",
    "customer_city",
    "order_date",
    "status",
    "net_total_cents",
  ]) {
    const header = page
      .locator(`thead th[data-key="_sort:${key}"]`)
      .filter({ visible: true });
    await header.getByRole("button").click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("sort"))
      .toBe(key);
    await expect(header).toHaveAttribute("aria-sort", /ascending|descending/);
  }
  await expect(
    page.getByRole("link", { name: "Esporta ordini CSV", exact: true }),
  ).toHaveAttribute("href", /sort=net_total_cents/);
  const csv = await page.request.get(
    `/api/portal/orders/export?brand_id=${brandId}`,
  );
  expect(csv.status()).toBe(200);
  const csvText = await csv.text();
  expect(csvText).toContain("Cliente riservato");
  expect(csvText).not.toContain("Private portal customer");
  expect(csvText).not.toContain("Secret dashboard note");
  expect(
    (
      await page.request.get(
        `/api/portal/orders/export?brand_id=${foreignBrandId}`,
      )
    ).status(),
  ).toBe(404);
  const [csvDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Esporta ordini CSV", exact: true }).click(),
  ]);
  await csvDownload.saveAs(info.outputPath("portal-orders.csv"));
  await page.goto(`/portal/orders/${orderIds[0]}`);
  await expect(page.locator("#content")).toContainText("Cliente riservato");
  await expect(page.locator("#content")).toContainText("10,00");
  await expect(page.locator("#content")).not.toContainText("Provvigione");
  const pdf = await page.request.get(
    `/api/pdf/order-confirmation/${orderIds[0]}`,
  );
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  const [pdfDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Scarica PDF ordine", exact: true }).click(),
  ]);
  await pdfDownload.saveAs(info.outputPath("portal-order.pdf"));
  await page.goto(`/portal/sales?brand_id=${brandId}`);
  for (const key of [
    "brand_name",
    "season_code",
    "customer_display_name",
    "customer_city",
    "net_cents",
    "order_count",
  ]) {
    const header = page
      .locator(`thead th[data-key="_sort:${key}"]`)
      .filter({ visible: true });
    await header.getByRole("button").click();
    await expect
      .poll(() => new URL(page.url()).searchParams.get("sort"))
      .toBe(key);
    await expect(header).toHaveAttribute("aria-sort", /ascending|descending/);
    const query = new URL(page.url()).search;
    expect(
      (await page.request.get(`/api/portal/sales/export${query}`)).status(),
    ).toBe(200);
  }
  expect(
    (
      await page.request.get(`/api/portal/sales/export?sort=private_notes`)
    ).status(),
  ).toBe(400);
  const salesCsv = await page.request.get(
    `/api/portal/sales/export?brand_id=${brandId}`,
  );
  expect(salesCsv.status()).toBe(200);
  const salesText = await salesCsv.text();
  expect(salesText).toContain("30,00");
  expect(salesText).toContain("Cliente riservato");
  expect(salesText).not.toContain("Private portal customer");
  expect(
    (
      await page.request.get(
        `/api/portal/sales/export?brand_id=${foreignBrandId}`,
      )
    ).status(),
  ).toBe(404);
  const [salesDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Esporta CSV", exact: true }).click(),
  ]);
  expect(salesDownload.suggestedFilename()).toBe("vendite-brand.csv");
  await expect(page.locator("#content")).toContainText("30,00");
  await expect(page.locator("#content")).toContainText("Cliente riservato");
  await expect(page.locator("#content")).not.toContainText(
    "Private portal customer",
  );
  await page.goto("/portal/documents");
  await expect(page.locator("#content")).toContainText(
    "Lookbook condiviso portale",
  );
  await expect(page.locator("#content")).not.toContainText(
    "Documento interno nascosto",
  );
  const download = await page.request.get(
    `/api/documents/${documentIds[0]}/download`,
  );
  expect(download.status()).toBe(200);
  expect(download.headers()["content-type"]).toContain("image/png");
  const [fileDownload] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("link", { name: "Lookbook condiviso portale", exact: true })
      .click(),
  ]);
  await fileDownload.saveAs(info.outputPath("portal-lookbook.png"));
  const hidden = await page.request.get(
    `/api/documents/${documentIds[1]}/download`,
  );
  expect(hidden.status()).toBe(404);
  await page.goto("/portal/calendar");
  await expect(
    page.locator(`[data-event-id="${sharedEventId}"]`).first(),
  ).toBeVisible();
  await expect(page.locator(`[data-event-id="${hiddenEventId}"]`)).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Nuovo evento", exact: true }),
  ).toHaveCount(0);
  await page.locator(`[data-event-id="${sharedEventId}"]`).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Descrizione condivisa");
  await expect(dialog).not.toContainText("Persona assegnata");
  await page.keyboard.press("Escape");
  const today = new Date(),
    start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString(),
    end = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString();
  const events = await page.request.get(
    `/api/portal/calendar?${new URLSearchParams({ start, end })}`,
  );
  expect(events.status()).toBe(200);
  const payload = await events.json();
  expect(payload.some((e: { id: string }) => e.id === sharedEventId)).toBe(
    true,
  );
  for (const e of payload) {
    expect(e).not.toHaveProperty("assigned_to");
    expect(e).not.toHaveProperty("customer_id");
  }
  for (const route of ["orders", "sales", "documents", "calendar"]) {
    await page.goto(`/portal/${route}`);
    for (const theme of ["Chiaro", "Scuro"]) {
      await setAppearance(page, theme);
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
      path: info.outputPath(`portal-${route}.png`),
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
test.afterAll(async () => {
  const cleanupDb = admin();
  if (paths.length) await cleanupDb.storage.from("documents").remove(paths);
  if (documentIds.length)
    await cleanupDb.from("documents").delete().in("id", documentIds);
  if (sharedEventId)
    await cleanupDb.from("events").delete().eq("id", sharedEventId);
  if (hiddenEventId)
    await cleanupDb.from("events").delete().eq("id", hiddenEventId);
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
    await db.from("brand_users").delete().eq("brand_id", brandId);
    await db.from("brands").delete().eq("id", brandId);
  }
  if (foreignBrandId) await db.from("brands").delete().eq("id", foreignBrandId);
  if (userId) await db.auth.admin.deleteUser(userId);
});
