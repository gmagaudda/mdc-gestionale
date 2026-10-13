import { setAppearance } from "./helpers/account";
import { completeAdminMfa } from "./helpers/mfa";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
const password = "Portal-local-fixture-42",
  name = `Report ${crypto.randomUUID()}`;
let email: string,
  userId: string,
  brandId: string,
  seasonId: string,
  productId: string,
  customerId: string,
  foreignBrandId: string;
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
  await db.from("profiles").update({ role: "brand" }).eq("id", userId);
  await db.from("brand_users").insert({ brand_id: brandId, user_id: userId });
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
    await db.from("brand_users").delete().eq("brand_id", brandId);
    await db.from("brands").delete().eq("id", brandId);
  }
  if (foreignBrandId) await db.from("brands").delete().eq("id", foreignBrandId);
  if (userId) await db.auth.admin.deleteUser(userId);
});
test("portal dashboard isolates brands and preserves customer privacy", async ({
  page,
}, info) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await completeAdminMfa(page);
  await expect(page).toHaveURL(/portal/);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (
      m.type() === "error" &&
      !(
        m.text().includes("status of 404 (Not Found)") &&
        m.location().url.includes(`brand_id=${foreignBrandId}`)
      )
    )
      errors.push(m.text());
  });
  await page.goto(
    `/portal/dashboard?brand_id=${brandId}&from=2032-01-01&to=2032-02-28`,
  );
  const summary = page.getByRole("region", { name: "Riepilogo", exact: true });
  await expect(summary).toContainText("30,00");
  const budget = page.getByRole("region", {
    name: "Budget e venduto",
    exact: true,
  });
  await expect(budget).toContainText("50,00");
  await expect(budget).toContainText("Cliente riservato");
  await expect(page.locator("#content")).not.toContainText(
    "Private portal customer",
  );
  await expect(page.locator("#content")).not.toContainText(
    "Foreign portal brand",
  );
  await expect(page.locator("#content")).not.toContainText("Fatturato netto");
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
    const button = await page
      .getByRole("button", { name: "Applica filtri", exact: true })
      .boundingBox();
    const fieldset = await page.locator("#content fieldset").boundingBox();
    expect(button!.y).toBeGreaterThanOrEqual(fieldset!.y + fieldset!.height);
  }
  await page.screenshot({
    path: info.outputPath("portal-dashboard.png"),
    fullPage: true,
  });
  await page.getByLabel("Al", { exact: true }).fill("2032-01-31");
  await page
    .getByRole("button", { name: "Applica filtri", exact: true })
    .click();
  await expect(summary).toContainText("10,00");
  expect(errors).toEqual([]);
  const forbidden = await page.goto(
    `/portal/dashboard?brand_id=${foreignBrandId}`,
  );
  expect(forbidden?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "404", exact: true }),
  ).toBeVisible();
  await page.goto("/portal/dashboard?from=2035-01-01&to=2035-01-31");
  await expect(
    page.getByRole("region", { name: "Budget e venduto", exact: true }),
  ).toContainText("Nessun budget");
  await page.goto(`/portal/dashboard?brand_id=${brandId}`);
  await page.getByRole("combobox", { name: "Brand", exact: true }).click();
  await expect(
    page.getByRole("option", { name: "Foreign portal brand", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  // Next dev + next-themes logs a script-remount warning on a full 404 document;
  // production Workers must have a clean console across that boundary as well.
  if ((process.env.E2E_BASE_URL ?? "").includes("8790"))
    expect(errors).toEqual([]);
});
