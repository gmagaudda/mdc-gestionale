import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
const password = "Pwa-local-fixture-42";
let email: string, userId: string;
const db = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
const production = process.env.E2E_PWA_PRODUCTION === "1";
test.beforeAll(async () => {
  if (
    !["localhost", "127.0.0.1"].includes(
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,
    )
  )
    throw Error("Local fixtures only");
  email = `pwa-${crypto.randomUUID()}@example.test`;
  const result = await db().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!result.data.user) throw Error("Fixture failed");
  userId = result.data.user.id;
  await db()
    .from("profiles")
    .update({ role: "staff", full_name: "Persona PWA" })
    .eq("id", userId);
});
test.afterAll(async () => {
  if (userId) await db().auth.admin.deleteUser(userId);
});
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
}
async function ready(page: Page) {
  await expect
    .poll(
      () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      { timeout: 20000 },
    )
    .toBe(true);
}
async function cacheUrls(page: Page) {
  return page.evaluate(async () => {
    const entries: string[] = [];
    for (const name of await caches.keys())
      for (const req of await (await caches.open(name)).keys())
        entries.push(req.url);
    return entries;
  });
}
test("manifest metadata and raster icons are valid", async ({ page }) => {
  const response = await page.request.get("/manifest.webmanifest");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain(
    "application/manifest+json",
  );
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: "MDC Gestionale",
    short_name: "MDC Gestionale",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "it",
  });
  expect(manifest.icons).toHaveLength(3);
  for (const icon of [
    ...manifest.icons,
    { src: "/icons/apple-touch-icon.png", sizes: "180x180" },
  ]) {
    const asset = await page.request.get(icon.src);
    expect(asset.status()).toBe(200);
    expect(asset.headers()["content-type"]).toContain("image/png");
    const png = await asset.body();
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.readUInt32BE(16)).toBe(Number(icon.sizes.split("x")[0]));
    expect(png.readUInt32BE(20)).toBe(Number(icon.sizes.split("x")[1]));
  }
  const worker = await page.request.get("/sw.js");
  expect(worker.headers()["cache-control"]).toContain("no-cache");
  expect(worker.headers()["service-worker-allowed"]).toBe("/");
  await page.goto("/login");
  await expect(
    page.locator('meta[name="apple-mobile-web-app-title"]'),
  ).toHaveAttribute("content", "MDC Gestionale");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/icons/apple-touch-icon.png",
  );
  expect(await page.locator('meta[name="theme-color"]').count()).toBe(2);
  if (!production)
    expect(
      await page.evaluate(
        async () => (await navigator.serviceWorker.getRegistrations()).length,
      ),
    ).toBe(0);
});
test("offline forms keep edits and block both button and keyboard writes", async ({
  page,
  context,
}, info) => {
  await login(page);
  await page.goto("/customers/new");
  const input = page.getByLabel("Ragione sociale", { exact: true });
  await input.fill("Bozza conservata offline");
  const save = page.getByRole("button", { name: "Salva cliente", exact: true });
  // Record POST attempts, including requestSubmit() that bypasses the disabled button.
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST")
      writes.push(new URL(request.url()).pathname);
  });
  await context.setOffline(true);
  await expect(
    page.getByRole("status").filter({ hasText: "Sei offline" }),
  ).toBeVisible();
  await expect(save).toBeDisabled();
  await input.fill("Bozza modificata offline");
  await input.press("Enter");
  await input.evaluate((element) =>
    (element as HTMLInputElement).form!.requestSubmit(),
  );
  await page.waitForTimeout(150);
  expect(writes).toEqual([]);
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
  await page.screenshot({
    path: info.outputPath("offline-form.png"),
    fullPage: true,
  });
  await context.setOffline(false);
  await expect(save).toBeEnabled();
  await expect(input).toHaveValue("Bozza modificata offline");
  await expect(
    page.getByRole("status").filter({ hasText: "Sei offline" }),
  ).toHaveCount(0);
});
test("install entry explains iOS and honors a deferred browser prompt", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    }),
  );
  await login(page);
  await page
    .locator("summary")
    .filter({ hasText: "Preferenze utente" })
    .click();
  await page.getByRole("button", { name: "Installa app", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Installa app",
    exact: true,
  });
  await expect(dialog).toContainText("In Safari, apri Condividi");
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt: async () => {
        document.documentElement.dataset.promptCalls = "1";
      },
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    window.dispatchEvent(event);
    document.documentElement.dataset.promptDeferred = String(
      event.defaultPrevented,
    );
  });
  await expect(page.locator("html")).toHaveAttribute(
    "data-prompt-deferred",
    "true",
  );
  await page.getByRole("button", { name: "Installa app", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-prompt-calls", "1");
  await expect(dialog).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(page.getByText("App installata", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Installa app", exact: true }),
  ).toHaveCount(0);
});
test("production service worker falls back offline and keeps business data out of caches", async ({
  page,
  context,
}) => {
  test.skip(!production, "Requires a production build");
  test.setTimeout(90000);
  await login(page);
  await ready(page);
  await page.goto("/orders");
  await page.goto("/customers");
  const urls = await cacheUrls(page);
  expect(urls.some((url) => new URL(url).pathname === "/offline")).toBe(true);
  for (const url of urls)
    expect(
      new URL(url).pathname === "/offline" ||
        new URL(url).pathname.startsWith("/_next/static/") ||
        new URL(url).pathname.startsWith("/icons/"),
    ).toBe(true);
  await context.setOffline(true);
  await page.goto("/orders?offline-probe=1");
  await expect(
    page.getByRole("heading", { name: "Sei offline", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Riprova", exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
  await page.getByRole("button", { name: "Riprova", exact: true }).click();
  await expect(page).toHaveURL(/dashboard$/);
  await page.evaluate(async () => {
    localStorage.setItem("business-test", "private");
    sessionStorage.setItem("business-test", "private");
    await (
      await caches.open("mdc-dynamic-test")
    ).put("/api/private", new Response("private"));
    await (
      await caches.open("mdc-public-v1")
    ).put("/orders", new Response("private"));
  });
  await page.getByRole("button", { name: "Esci", exact: true }).click();
  await expect(page).toHaveURL(/login$/);
  expect(
    await page.evaluate(() => [
      localStorage.getItem("business-test"),
      sessionStorage.getItem("business-test"),
    ]),
  ).toEqual([null, null]);
  expect(await page.evaluate(async () => caches.keys())).not.toContain(
    "mdc-dynamic-test",
  );
  for (const url of await cacheUrls(page))
    expect(
      new URL(url).pathname === "/offline" ||
        new URL(url).pathname.startsWith("/_next/static/") ||
        new URL(url).pathname.startsWith("/icons/"),
    ).toBe(true);
});
test("production update waits for consent and cancellation preserves edits", async ({
  page,
}) => {
  test.skip(!production, "Requires local production Worker assets");
  test.setTimeout(90000);
  const url = new URL(process.env.E2E_BASE_URL!);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "8790")
    throw Error("Update fixture only supports local Wrangler on port 8790");
  const path = ".open-next/assets/sw.js",
    original = readFileSync(path, "utf8");
  try {
    await login(page);
    await ready(page);
    await page.goto("/customers/new");
    await page
      .getByLabel("Ragione sociale", { exact: true })
      .fill("Bozza prima dell’aggiornamento");
    writeFileSync(
      path,
      original.replace('CACHE_VERSION = "v1"', 'CACHE_VERSION = "v2-e2e"'),
    );
    await expect
      .poll(async () => (await page.request.get("/sw.js")).text())
      .toContain("v2-e2e");
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration!.update();
    });
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Nuova versione disponibile" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Ragione sociale", { exact: true }),
    ).toHaveValue("Bozza prima dell’aggiornamento");
    await page.getByRole("button", { name: "Aggiorna", exact: true }).click();
    const dialog = page.getByRole("dialog", {
      name: "Aggiornare MDC Gestionale?",
      exact: true,
    });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Annulla", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(
      page.getByLabel("Ragione sociale", { exact: true }),
    ).toHaveValue("Bozza prima dell’aggiornamento");
    await page.getByRole("button", { name: "Aggiorna", exact: true }).click();
    await Promise.all([
      page.waitForEvent("load"),
      dialog.getByRole("button", { name: "Aggiorna", exact: true }).click(),
    ]);
    await expect(
      page.getByLabel("Ragione sociale", { exact: true }),
    ).toHaveValue("");
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Nuova versione disponibile" }),
    ).toHaveCount(0);
    expect(await page.evaluate(async () => caches.keys())).not.toContain(
      "mdc-public-v1",
    );
  } finally {
    writeFileSync(path, original);
  }
});
