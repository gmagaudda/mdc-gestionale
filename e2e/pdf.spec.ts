import { signOut } from "./helpers/account";
import { selectChoice } from "./helpers/navigation";
import { completeAdminMfa } from "./helpers/mfa";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
const password = "Pdf-local-fixture-42";
let email: string,
  userId: string,
  brandId: string,
  otherBrandId: string,
  customerId: string,
  seasonId: string,
  otherSeasonId: string,
  productId: string,
  otherProductId: string,
  orderId: string,
  otherOrderId: string;
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
  email = `pdf-${crypto.randomUUID()}@example.test`;
  const user = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  userId = user.data.user!.id;
  await admin().from("profiles").update({ role: "staff" }).eq("id", userId);
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  await db.auth.signInWithPassword({ email, password });
  customerId = (
    await admin()
      .from("customers")
      .insert({ legal_name: "Cliente segreto PDF", city: "Milano" })
      .select("id")
      .single()
  ).data!.id;
  const make = async (name: string) => {
    const brand = (
      await admin()
        .from("brands")
        .insert({ name, can_see_customer_names: false })
        .select("id")
        .single()
    ).data!.id;
    const season = (
      await db
        .from("seasons")
        .insert({ brand_id: brand, code: "PDF-FW26", name: "Autunno inverno" })
        .select("id")
        .single()
    ).data!.id;
    const product = await db.rpc("save_product", {
      p_id: null,
      p_data: {
        brand_id: brand,
        season_id: season,
        sku_base: `PDF-${crypto.randomUUID()}`,
        name: "Camicia qualità",
        description: "Cotone, vestibilità regolare.",
        wholesale_price_cents: 1999,
        retail_price_cents: 5000,
        vat_rate: 22,
        sizes: ["S", "M", "L"],
        colors: ["Blu", "Nero"],
      },
    });
    const variant = (
      await admin()
        .from("product_variants")
        .select("id")
        .eq("product_id", product.data!)
        .limit(1)
    ).data![0].id;
    const order = await db.rpc("save_order", {
      p_id: null,
      p_data: {
        brand_id: brand,
        customer_id: customerId,
        season_id: season,
        order_date: "2026-10-12",
        delivery_date: "",
        payment_terms: "30 giorni",
        discount_pct: 0,
        commission_pct_override: 12,
        internal_notes: "Nota interna PDF da non divulgare",
      },
      p_lines: [
        {
          variant_id: variant,
          quantity: 2,
          unit_price_cents: 1999,
          discount_pct: 0,
        },
      ],
    });
    if (order.error) throw order.error;
    return { brand, season, product: product.data!, order: order.data! };
  };
  const own = await make("Marchio PDF prova");
  const other = await make("Altro marchio PDF");
  ({
    brand: brandId,
    season: seasonId,
    product: productId,
    order: orderId,
  } = own);
  ({
    brand: otherBrandId,
    season: otherSeasonId,
    product: otherProductId,
    order: otherOrderId,
  } = other);
});
test.afterAll(async () => {
  if (brandId && otherBrandId) {
    const ids = `'${brandId}','${otherBrandId}'`;
    const file = `/tmp/mdc-pdf-${brandId}.sql`;
    writeFileSync(
      file,
      `do $$begin delete from app.order_confirmations where order_id in (select id from public.orders where brand_id in (${ids}));delete from public.customer_contacts where customer_id='${customerId}';delete from public.order_lines where brand_id in (${ids});delete from public.order_status_history where brand_id in (${ids});delete from public.order_private where brand_id in (${ids});delete from public.orders where brand_id in (${ids});end $$;`,
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
    await admin()
      .from("product_variants")
      .delete()
      .in("product_id", [productId, otherProductId]);
    await admin()
      .from("products")
      .delete()
      .in("id", [productId, otherProductId]);
    await admin().from("seasons").delete().in("id", [seasonId, otherSeasonId]);
    await admin().from("brand_users").delete().eq("user_id", userId);
    await admin().from("customers").delete().eq("id", customerId);
    await admin().from("brands").delete().in("id", [brandId, otherBrandId]);
  }
  if (userId) await admin().auth.admin.deleteUser(userId);
});
test("generates print PDFs and enforces brand isolation and customer privacy", async ({
  page,
}) => {
  const login = async () => {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Accedi", exact: true }).click();
    await completeAdminMfa(page);
    await expect(
      page.getByRole("button", { name: /^Menu utente di / }),
    ).toBeVisible();
    await expect(page).toHaveURL(/dashboard$/);
  };
  expect(
    (await page.request.get(`/api/pdf/order-confirmation/${orderId}`)).status(),
  ).toBe(401);
  await login();
  await page.goto(`/orders/${orderId}`);
  await expect(
    page.getByRole("link", { name: "Scarica PDF ordine", exact: true }),
  ).toHaveAttribute("href", `/api/pdf/order-confirmation/${orderId}`);
  const download = async (type: string, id: string, file: string) => {
    const response = await page.request.get(`/api/pdf/${type}/${id}`);
    expect(
      response.status(),
      response.ok() ? "PDF" : await response.text(),
    ).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/pdf");
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    const bytes = await response.body();
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
    mkdirSync("output/pdf", { recursive: true });
    writeFileSync(`output/pdf/${file}`, bytes);
    return bytes;
  };
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await download(
    "order-confirmation",
    orderId,
    "order-confirmation-internal.pdf",
  );
  await page.goto(`/seasons/${seasonId}`);
  await expect(
    page.getByRole("link", { name: "Scarica catalogo PDF", exact: true }),
  ).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await download("line-sheet", seasonId, "line-sheet-demo.pdf");
  await admin().from("profiles").update({ role: "brand" }).eq("id", userId);
  await admin()
    .from("brand_users")
    .insert({ brand_id: brandId, user_id: userId });
  await page.goto("/dashboard");
  await signOut(page);
  await expect(page).toHaveURL(/\/login$/);
  await login();
  await download("order-confirmation", orderId, "order-confirmation-demo.pdf");
  expect(
    (
      await page.request.get(`/api/pdf/order-confirmation/${otherOrderId}`)
    ).status(),
  ).toBe(404);
  expect(
    (await page.request.get(`/api/pdf/line-sheet/${otherSeasonId}`)).status(),
  ).toBe(404);
  expect((await page.request.get(`/api/pdf/invalid/${orderId}`)).status()).toBe(
    404,
  );
});

test("brand summary download preserves date filters, privacy and recoverable errors", async ({
  page,
}) => {
  const url = `/api/pdf/brand-summary/${brandId}`;
  expect((await page.request.get(url)).status()).toBe(401);
  await admin().from("profiles").update({ role: "staff" }).eq("id", userId);
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  await db.auth.signInWithPassword({ email, password });
  const confirmed = await db.rpc("change_order_status", {
    p_id: orderId,
    p_status: "confirmed",
    p_note: "",
  });
  if (confirmed.error) throw confirmed.error;
  const login = async () => {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Accedi", exact: true }).click();
    await expect(
      page.getByRole("button", { name: /^Menu utente di / }),
    ).toBeVisible();
  };
  const save = async (path: string, name: string) => {
    const response = await page.request.get(path);
    expect(
      response.status(),
      response.ok() ? "PDF" : await response.text(),
    ).toBe(200);
    expect(response.headers()["cache-control"]).toBe("private, no-store");
    const bytes = await response.body();
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getTitle()).toBe("Riepilogo vendite brand");
    mkdirSync("output/pdf", { recursive: true });
    writeFileSync(`output/pdf/${name}`, bytes);
  };
  await login();
  await page.goto(`/brands/${brandId}`);
  const button = page.getByRole("button", {
    name: "Scarica riepilogo PDF",
    exact: true,
  });
  await expect(button).toBeVisible();
  const bounds = await button.boundingBox();
  expect(bounds!.height).toBeGreaterThanOrEqual(44);
  await page.route(`**${url}`, (route) => route.fulfill({ status: 503 }));
  await button.focus();
  await button.press("Enter");
  await expect(
    page.getByText("Impossibile generare il PDF. Controlla i dati e riprova.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.unroute(`**${url}`);
  const downloading = page.waitForEvent("download");
  await button.click();
  const file = await downloading;
  expect(file.suggestedFilename()).toBe("riepilogo-brand.pdf");
  await expect(
    page.getByText("Riepilogo PDF pronto. Download avviato.", { exact: true }),
  ).toBeVisible();
  await save(url, "brand-summary-internal.pdf");
  expect(
    (await page.request.get(`${url}?season_id=${otherSeasonId}`)).status(),
  ).toBe(404);
  expect(
    (await page.request.get(`${url}?from=2026-10-13&to=2026-10-12`)).status(),
  ).toBe(400);
  await save(`${url}?from=2026-10-13`, "brand-summary-empty.pdf");
  await signOut(page);
  await expect(page).toHaveURL(/\/login$/);
  await admin().from("profiles").update({ role: "brand" }).eq("id", userId);
  await admin()
    .from("brand_users")
    .upsert({ brand_id: brandId, user_id: userId });
  await login();
  await page.goto(
    `/portal/sales?brand_id=${brandId}&season_id=${seasonId}&from=2026-10-12&to=2026-10-12`,
  );
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.evaluate(() => {
      localStorage.removeItem("theme");
    });
    await page.reload();
    await expect(button).toBeVisible();
    const request = page.waitForRequest(
      (req) => new URL(req.url()).pathname === url,
    );
    const download = page.waitForEvent("download");
    await button.click();
    const actual = new URL((await request).url());
    expect(actual.searchParams.get("season_id")).toBe(seasonId);
    expect(actual.searchParams.get("from")).toBe("2026-10-12");
    expect(actual.searchParams.get("to")).toBe("2026-10-12");
    await download;
    await expect(
      page.getByText("Riepilogo PDF pronto. Download avviato.", {
        exact: true,
      }),
    ).toBeVisible();
    // Success text precedes the end of the loading label's CSS fade.
    await button.evaluate(async (element) => {
      await Promise.allSettled(
        element
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished),
      );
    });
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.screenshot({
      path: `output/pdf/brand-summary-${theme}-${page.viewportSize()!.width}.png`,
      fullPage: true,
    });
  }
  await save(`${url}?season_id=${seasonId}`, "brand-summary-private.pdf");
  expect(
    (await page.request.get(`/api/pdf/brand-summary/${otherBrandId}`)).status(),
  ).toBe(404);
  expect(
    (await page.request.get(`${url}?season_id=${otherSeasonId}`)).status(),
  ).toBe(404);
  await admin()
    .from("brands")
    .update({ can_see_customer_names: true })
    .eq("id", brandId);
  await save(url, "brand-summary-shared.pdf");
});

test("manually sends a confirmation in log mode with durable history and recipient validation", async ({
  page,
}) => {
  test.setTimeout(60000);
  await admin().from("profiles").update({ role: "staff" }).eq("id", userId);
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  await db.auth.signInWithPassword({ email, password });
  const current = await db
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();
  if (current.data?.status === "draft")
    expect(
      (
        await db.rpc("change_order_status", {
          p_id: orderId,
          p_status: "confirmed",
          p_note: "",
        })
      ).error,
    ).toBeNull();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL("/dashboard");
  await page.goto(`/orders/${orderId}`);
  const section = page.getByRole("region", {
    name: "Conferma via email",
    exact: true,
  });
  await expect(
    section.getByText(
      "Il cliente non ha contatti attivi con un indirizzo email valido.",
    ),
  ).toBeVisible();
  const contact = await admin()
    .from("customer_contacts")
    .insert({
      customer_id: customerId,
      name: "Buyer conferma",
      email: "buyer-confirmation@example.test",
    })
    .select("id")
    .single();
  expect(contact.error).toBeNull();
  await page.reload();
  const send = section.getByRole("button", {
    name: "Invia conferma",
    exact: true,
  });
  await send.click();
  await expect(
    section.getByRole("combobox", {
      name: "Destinatario della conferma",
      exact: true,
    }),
  ).toHaveAttribute("aria-invalid", "true");
  await selectChoice(
    page,
    "Destinatario della conferma",
    "Buyer conferma",
    true,
  );
  await admin()
    .from("customer_contacts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", contact.data!.id);
  await send.focus();
  await send.press("Enter");
  await expect(section.getByRole("alert")).toBeVisible();
  await admin()
    .from("customer_contacts")
    .update({ deleted_at: null })
    .eq("id", contact.data!.id);
  await send.click();
  await expect(section.getByRole("status")).toHaveText(
    "Conferma registrata in modalità log. Nessuna email è stata inviata.",
  );
  await expect(section.getByRole("listitem")).toHaveCount(1);
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.evaluate(() => localStorage.removeItem("theme"));
    await page.reload();
    await expect(section.getByRole("listitem")).toContainText(
      "Registrata in modalità log",
    );
    await selectChoice(
      page,
      "Destinatario della conferma",
      "Buyer conferma",
      true,
    );
    await send.click();
    await expect(section.getByRole("status")).toContainText(
      "Nessuna email è stata inviata.",
    );
    await expect(section.getByRole("listitem")).toHaveCount(1);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
    const box = await send.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({
      path: `output/pdf/order-email-${theme}-${page.viewportSize()!.width}.png`,
      fullPage: true,
    });
  }
  await signOut(page);
  await expect(page).toHaveURL(/\/login$/);
  await admin()
    .from("profiles")
    .update({ role: "accounting" })
    .eq("id", userId);
  expect(
    (
      await db.rpc("prepare_order_confirmation", {
        p_order_id: orderId,
        p_contact_id: contact.data!.id,
      })
    ).error?.code,
  ).toBe("42501");
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL("/dashboard");
  await page.goto(`/orders/${orderId}`);
  await expect(section).toHaveCount(0);
});
