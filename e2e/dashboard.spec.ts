import { completeAdminMfa } from "./helpers/mfa";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
const password = "Dashboard-local-fixture-42",
  name = `Report ${crypto.randomUUID()}`;
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
  if (brandId) await db.from("brands").delete().eq("id", brandId);
  if (userId) await db.auth.admin.deleteUser(userId);
});
test("reports exact seed totals filters and accessible charts", async ({
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
    `/dashboard?brand_id=${brandId}&season_id=${seasonId}&from=2032-01-01&to=2032-02-28`,
  );
  await expect(
    page.getByRole("region", { name: "Riepilogo", exact: true }),
  ).toContainText("30,00");
  const budget = page.getByRole("region", {
    name: "Budget e venduto",
    exact: true,
  });
  await expect(budget).toContainText("50,00");
  await expect(budget).toContainText("-20,00");
  await expect(budget).toContainText("-40%");
  await expect(
    page.getByRole("region", { name: "Andamento del venduto", exact: true }),
  ).toContainText("2032-02");
  if (info.project.name === "tablet") {
    const scroller = page.getByRole("region", {
      name: "Tabella: Budget e venduto",
      exact: true,
    });
    await scroller.focus();
    await scroller.press("ArrowRight");
    await expect
      .poll(() => scroller.evaluate((node) => node.scrollLeft))
      .toBeGreaterThan(0);
  }
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
  await page.screenshot({
    path: info.outputPath("dashboard.png"),
    fullPage: true,
  });
  const trend = page.getByRole("region", {
    name: "Andamento del venduto",
    exact: true,
  });
  await trend.scrollIntoViewIfNeeded();
  const line = trend.locator("svg path").first();
  await expect(line).toHaveAttribute("d", /^M/);
  await expect
    .poll(() =>
      trend
        .locator("svg clipPath rect")
        .evaluate((node) => Number(node.getAttribute("width"))),
    )
    .toBeGreaterThan(10);
  await page.getByLabel("Al", { exact: true }).fill("2032-01-31");
  await page
    .getByRole("button", { name: "Applica filtri", exact: true })
    .click();
  await expect(page).toHaveURL(/to=2032-01-31/);
  await expect(
    page.getByRole("region", { name: "Riepilogo", exact: true }),
  ).toContainText("10,00");
  // Budget compares its whole period, even when the KPI filter is narrower.
  await expect(
    page.getByRole("region", { name: "Budget e venduto", exact: true }),
  ).toContainText("30,00");
  await page.goBack();
  await expect(page.getByLabel("Al", { exact: true })).toHaveValue(
    "2032-02-28",
  );
  await page.goto(
    `/dashboard?brand_id=${brandId}&from=2035-01-01&to=2035-01-31`,
  );
  await expect(
    page.getByRole("region", { name: "Budget e venduto", exact: true }),
  ).toContainText("Nessun budget");
  await expect(
    page.getByRole("region", { name: "Andamento del venduto", exact: true }),
  ).toContainText("Nessun ordine confermato");
  await page.goto("/dashboard?from=2032-02-01&to=2032-01-01");
  await expect(
    page.getByRole("alert").filter({ hasText: "Controlla i filtri" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
