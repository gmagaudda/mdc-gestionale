import { openUserMenu } from "./helpers/account";
import { completeAdminMfa, enrollFixtureMfa } from "./helpers/mfa";
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
const password = "Responsive-local-fixture-42";
let email: string, portalEmail: string, userId: string, portalId: string;
let brandId: string,
  customerId: string,
  seasonId: string,
  productId: string,
  orderId: string;
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
  email = `responsive-${crypto.randomUUID()}@example.test`;
  portalEmail = `responsive-portal-${crypto.randomUUID()}@example.test`;
  for (const [address, role] of [
    [email, "admin"],
    [portalEmail, "brand"],
  ] as const) {
    const result = await db.auth.admin.createUser({
      email: address,
      password,
      email_confirm: true,
    });
    if (!result.data.user) throw Error("User fixture failed");
    const id = result.data.user.id;
    if (role === "admin") userId = id;
    else portalId = id;
    const profile = await db
      .from("profiles")
      .update({ role, full_name: "Persona audit responsive" })
      .eq("id", id);
    if (profile.error) throw profile.error;
  }
  const name = `Audit responsive ${crypto.randomUUID()}`;
  const brand = await db.from("brands").insert({ name }).select("id").single();
  if (!brand.data) throw Error("Brand fixture failed");
  brandId = brand.data.id;
  const membership = await db
    .from("brand_users")
    .insert({ brand_id: brandId, user_id: portalId });
  if (membership.error) throw membership.error;
  const customer = await db
    .from("customers")
    .insert({ legal_name: name, city: "Milano" })
    .select("id")
    .single();
  if (!customer.data) throw Error("Customer fixture failed");
  customerId = customer.data.id;
  const season = await db
    .from("seasons")
    .insert({ brand_id: brandId, code: "AUDIT", name })
    .select("id")
    .single();
  if (!season.data) throw Error("Season fixture failed");
  seasonId = season.data.id;
  const session = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  const login = await session.auth.signInWithPassword({ email, password });
  if (login.error) throw login.error;
  await enrollFixtureMfa(session, email);
  const product = await session.rpc("save_product", {
    p_id: null,
    p_data: {
      brand_id: brandId,
      season_id: seasonId,
      sku_base: name,
      name,
      description: "",
      wholesale_price_cents: 1000,
      retail_price_cents: 2000,
      vat_rate: 22,
      sizes: ["M"],
      colors: ["Nero"],
    },
  });
  if (!product.data) throw Error("Product fixture failed");
  productId = product.data;
  const variant = await session
    .from("product_variants")
    .select("id")
    .eq("product_id", productId)
    .single();
  if (!variant.data) throw Error("Variant fixture failed");
  const order = await session.rpc("save_order", {
    p_id: null as unknown as string,
    p_data: {
      brand_id: brandId,
      season_id: seasonId,
      customer_id: customerId,
      order_date: "2032-01-01",
      delivery_date: "",
      discount_pct: 0,
      internal_notes: "",
    },
    p_lines: [
      {
        variant_id: variant.data.id,
        quantity: 1,
        unit_price_cents: 1000,
        discount_pct: 0,
      },
    ],
  });
  if (!order.data) throw Error("Order fixture failed");
  orderId = order.data;
});
test.afterAll(async () => {
  const db = admin();
  if (orderId) {
    await db.from("order_lines").delete().eq("order_id", orderId);
    await db.from("order_status_history").delete().eq("order_id", orderId);
    await db.from("order_private").delete().eq("id", orderId);
    await db.from("orders").delete().eq("id", orderId);
  }
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
  for (const id of [userId, portalId])
    if (id) await db.auth.admin.deleteUser(id);
});
async function login(page: Page, address: string) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(address);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await completeAdminMfa(page);
  await expect(page).toHaveURL(/dashboard$/);
}
async function audit(page: Page, route: string) {
  await page.goto(route);
  // Next keeps inactive route trees hidden while a streamed navigation settles.
  await expect(page.locator("h1:visible")).toHaveCount(1);
  await expect(page.locator("h1:visible")).toBeVisible();
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  if (await menu.isVisible()) {
    await menu.click();
    await expect(
      page
        .getByRole("dialog", { name: "Menu", exact: true })
        .getByRole("navigation"),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
  } else await expect(page.locator(".app-sidebar nav")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    route,
  ).toBe(true);
  const undersized = await page
    .locator(
      '#content button, #content input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), #content select',
    )
    .evaluateAll((nodes) =>
      nodes
        .filter(
          (n) =>
            n.getClientRects().length > 0 &&
            !(
              n instanceof HTMLElement &&
              n.tabIndex === -1 &&
              n.getAttribute("aria-hidden") === "true"
            ),
        )
        .map((n) => ({
          name:
            n.getAttribute("aria-label") ||
            n.getAttribute("name") ||
            n.textContent?.trim(),
          // Arc's money input focuses from its full-height clickable amount area.
          height: (
            n.closest('[class*="__amountWrap"]') ?? n
          ).getBoundingClientRect().height,
          width: (
            n.closest('[class*="__amountWrap"]') ?? n
          ).getBoundingClientRect().width,
        }))
        .filter((n) => n.height < 43.5 || n.width < 43.5),
    );
  expect(undersized, route).toEqual([]);
  const inputs = await page
    .locator(
      'input[type="email"], input[type="tel"], input[inputmode="decimal"], input[inputmode="numeric"]',
    )
    .evaluateAll((nodes) =>
      nodes.map((n) => ({
        type: (n as HTMLInputElement).type,
        mode: (n as HTMLInputElement).inputMode,
      })),
    );
  for (const input of inputs)
    expect(
      ["email", "tel"].includes(input.type) ||
        ["decimal", "numeric"].includes(input.mode),
    ).toBe(true);
  const buttons = page.locator(
    '#content button:not(:disabled):not([aria-disabled="true"])',
  );
  for (let i = 0; i < (await buttons.count()); i++) {
    const button = buttons.nth(i);
    if (await button.isVisible()) await button.click({ trial: true });
  }
  await page.waitForTimeout(350);
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    axe.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
    route,
  ).toEqual([]);
}
for (const scheme of ["light", "dark"] as const) {
  test(`internal routes and editor adapt in ${scheme} system theme`, async ({
    page,
  }) => {
    test.setTimeout(180000);
    await page.emulateMedia({ colorScheme: scheme });
    await page.addInitScript(() => localStorage.removeItem("theme"));
    await login(page, email);
    for (const route of [
      "/dashboard",
      "/brands",
      "/customers",
      "/seasons",
      "/products",
      "/orders",
      "/orders/new",
      "/calendar",
      "/documents",
      "/documents/new",
      "/budgets",
      "/budgets/new",
      "/invoices",
      "/commissions",
      "/settings/users",
      "/settings/users/new",
      "/settings/audit",
      `/settings/users/${userId}`,
      "/brands/new",
      "/customers/new",
      "/seasons/new",
      "/products/new",
      `/brands/${brandId}`,
      `/brands/${brandId}/edit`,
      `/customers/${customerId}`,
      `/customers/${customerId}/edit`,
      `/seasons/${seasonId}`,
      `/seasons/${seasonId}/edit`,
      `/products/${productId}`,
      `/products/${productId}/edit`,
      `/orders/${orderId}`,
      `/orders/${orderId}/edit`,
    ]) {
      await audit(page, route);
      await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
    }
  });
  test(`portal routes adapt in ${scheme} system theme`, async ({ page }) => {
    test.setTimeout(90000);
    await page.emulateMedia({ colorScheme: scheme });
    await page.addInitScript(() => localStorage.removeItem("theme"));
    await login(page, portalEmail);
    for (const route of [
      "/portal/dashboard",
      "/portal/orders",
      "/portal/sales",
      "/portal/documents",
      "/portal/calendar",
    ]) {
      await audit(page, route);
      await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
    }
  });
}

test("text resize, 320px reflow and keyboard focus remain usable", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "One dedicated stress project; base audit covers all five viewports.",
  );
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await login(page, email);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of [
        "/dashboard",
        "/customers/new",
        "/orders",
        `/orders/${orderId}/edit`,
        "/budgets/new",
        "/calendar",
        "/documents/new",
        "/commissions",
        "/settings/users/new",
      ]) {
        await page.goto(route);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        if (width === 1440)
          await page.evaluate(() => {
            // Double computed text sizes, including vendor controls, without compounding descendants.
            const nodes = [
              ...document.querySelectorAll<HTMLElement>("body *"),
            ].filter((node) => node.offsetWidth || node.offsetHeight);
            const sizes = nodes.map((node) =>
              parseFloat(getComputedStyle(node).fontSize),
            );
            nodes.forEach((node, i) => {
              if (sizes[i]) node.style.fontSize = `${sizes[i] * 2}px`;
            });
          });
        // Arc label slots measure their new natural width with ResizeObserver.
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              ),
            ),
        );
        const overflowing = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>("body *")]
            .filter((node) => {
              const r = node.getBoundingClientRect();
              return (
                r.width &&
                r.right > innerWidth + 1 &&
                getComputedStyle(node).position !== "absolute"
              );
            })
            .map((node) => ({
              tag: node.tagName,
              class: node.className,
              text: node.textContent?.slice(0, 80),
              right: node.getBoundingClientRect().right,
              width: node.getBoundingClientRect().width,
            }))
            .slice(0, 20),
        );
        const fits = await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        );
        if (!fits)
          await page.screenshot({
            path: info.outputPath("resize-failure.png"),
            fullPage: true,
          });
        expect(
          fits,
          `${scheme} ${width} ${route}: ${JSON.stringify(overflowing)}`,
        ).toBe(true);
        for (const input of await page
          .locator(
            '#content input:not([type="hidden"]):not([aria-hidden="true"]):not(:disabled), #content select:not([aria-hidden="true"]):not(:disabled), #content textarea:not(:disabled), #content [role="checkbox"]:not(:disabled)',
          )
          .all()) {
          if (!(await input.isVisible())) continue;
          await input.focus();
          await input.evaluate((node) =>
            node.scrollIntoView({ block: "center", inline: "nearest" }),
          );
          const visibility = await input.evaluate((node) => {
            const r = node.getBoundingClientRect();
            const x = Math.max(
              1,
              Math.min(innerWidth - 1, r.left + r.width / 2),
            );
            const y = Math.max(
              1,
              Math.min(innerHeight - 1, r.top + r.height / 2),
            );
            const target = document.elementFromPoint(x, y);
            return {
              visible:
                target === node ||
                node.contains(target) ||
                Boolean(node.closest("label")?.contains(target)),
              type: (node as HTMLInputElement).type,
              name: (node as HTMLInputElement).name,
              id: node.id,
              target: target?.outerHTML.slice(0, 200),
              rect: { x: r.x, y: r.y, width: r.width, height: r.height },
            };
          });
          if (!visibility.visible)
            await page.screenshot({
              path: info.outputPath("focus-failure.png"),
            });
          expect(
            visibility.visible,
            `${route}: ${JSON.stringify(visibility)}`,
          ).toBe(true);
        }
      }
    }
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/dashboard");
  await openUserMenu(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("account-320-dark.png"),
    fullPage: true,
  });
});
