import { completeAdminMfa } from "./helpers/mfa";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import ICAL from "ical.js";
import { newIcalToken, hashToken } from "../lib/calendar/token";
import { tomorrowInRome } from "../lib/calendar/reminders";
const password = "Feed-local-fixture-42";
let email: string,
  userId: string,
  brandUserId: string,
  brandId: string,
  eventId: string,
  brandToken: string;
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
  email = `feed-${crypto.randomUUID()}@example.test`;
  const staff = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  userId = staff.data.user!.id;
  await db
    .from("profiles")
    .update({ role: "staff", full_name: "Persona abbonamento" })
    .eq("id", userId);
  const brandEmail = `feed-brand-${crypto.randomUUID()}@example.test`;
  const brandUser = await db.auth.admin.createUser({
    email: brandEmail,
    password,
    email_confirm: true,
  });
  brandUserId = brandUser.data.user!.id;
  brandId = (
    await db
      .from("brands")
      .insert({ name: `Feed ${crypto.randomUUID()}` })
      .select("id")
      .single()
  ).data!.id;
  await db
    .from("brand_users")
    .insert({ brand_id: brandId, user_id: brandUserId });
  const range = tomorrowInRome(new Date()),
    start = new Date(Date.parse(range.start) + 9 * 3600000).toISOString(),
    end = new Date(Date.parse(start) + 3600000).toISOString();
  const events = await db
    .from("events")
    .insert([
      {
        title: "Appuntamento pubblico 🧵, lana",
        type: "appointment",
        description: "Prima riga\nSeconda riga",
        location: "Showroom",
        starts_at: start,
        ends_at: end,
        assigned_to: userId,
        brand_id: brandId,
        visible_to_brand: true,
      },
      {
        title: "Evento riservato al personale",
        description: "",
        location: "",
        starts_at: start,
        ends_at: end,
        assigned_to: userId,
        brand_id: brandId,
        visible_to_brand: false,
        type: "other",
      },
    ])
    .select("id");
  if (events.error) throw Error(events.error.message);
  eventId = events.data[0].id;
  const brandSession = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  await brandSession.auth.signInWithPassword({ email: brandEmail, password });
  brandToken = newIcalToken();
  const rotated = await brandSession.rpc("rotate_ical_token", {
    p_hash: await hashToken(brandToken),
  });
  if (rotated.error) throw Error(rotated.error.message);
});
test.afterAll(async () => {
  if (userId) await admin().from("events").delete().eq("assigned_to", userId);
  if (brandId) await admin().from("brands").delete().eq("id", brandId);
  if (userId) await admin().auth.admin.deleteUser(userId);
  if (brandUserId) await admin().auth.admin.deleteUser(brandUserId);
});
test("subscribes rotates and revokes a private feed and processes local reminders once", async ({
  page,
  request,
}, info) => {
  expect((await request.post("/api/cron/reminders")).status()).toBe(401);
  expect((await request.get("/api/ical/invalid")).status()).toBe(404);
  const brandFeed = await request.get(`/api/ical/${brandToken}`);
  expect(brandFeed.status()).toBe(200);
  const brandEvents = new ICAL.Component(
    ICAL.parse(await brandFeed.text()),
  ).getAllSubcomponents("vevent");
  expect(brandEvents).toHaveLength(1);
  expect(new ICAL.Event(brandEvents[0]).summary).toBe(
    "Appuntamento pubblico 🧵, lana",
  );
  expect(await brandFeed.text()).not.toContain("Evento riservato");
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await completeAdminMfa(page);
  await expect(
    page.getByRole("button", { name: "Esci", exact: true }),
  ).toBeVisible();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/calendar");
  await page
    .getByRole("button", { name: "Genera link iCal", exact: true })
    .click();
  const field = page.getByLabel("Link di abbonamento iCal", { exact: true });
  await expect(field).toBeVisible();
  const url = await field.inputValue();
  const path = new URL(url).pathname;
  const feed = await request.get(path);
  expect(feed.status()).toBe(200);
  expect(feed.headers()["cache-control"]).toContain("no-store");
  const parsed = new ICAL.Component(ICAL.parse(await feed.text()));
  expect(
    parsed
      .getAllSubcomponents("vevent")
      .map((event) => new ICAL.Event(event).summary),
  ).toContain("Evento riservato al personale");
  // Reload keeps metadata, but never recovers the plaintext token.
  await page.reload();
  await expect(field).toHaveCount(0);
  await page
    .getByRole("button", { name: "Rigenera link iCal", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Annulla", exact: true }),
  ).toBeFocused();
  await dialog
    .getByRole("button", { name: "Rigenera link iCal", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(field).toBeVisible();
  expect((await request.get(path)).status()).toBe(404);
  const rotatedPath = new URL(await field.inputValue()).pathname;
  await expect(
    page.getByRole("button", { name: "Copia link", exact: true }),
  ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Preferenze utente" })
    .click();
  for (const theme of ["Chiaro", "Scuro"]) {
    await page.getByRole("button", { name: theme, exact: true }).click();
    const axe = await new AxeBuilder({ page }).analyze();
    expect(
      axe.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
  }
  await field.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `test-results/calendar-feed-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Revoca link iCal", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Revoca link iCal", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect((await request.get(rotatedPath)).status()).toBe(404);
  await expect(page.getByText("Link revocato.", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Genera link iCal", exact: true }),
  ).toBeFocused();
  // Local transport renders the actual email, records 'logged', and never sends to an external provider.
  expect(process.env.EMAIL_MODE).toBe("log");
  const secret = process.env.CRON_SECRET!;
  expect(secret.length).toBeGreaterThanOrEqual(32);
  const first = await request.post("/api/cron/reminders", {
    headers: { Authorization: `Bearer ${secret}` },
  });
  expect(first.status()).toBe(200);
  const recorded = await admin()
    .from("event_reminders")
    .select("status")
    .eq("event_id", eventId)
    .single();
  expect(recorded.data?.status).toBe("logged");
  const second = await request.post("/api/cron/reminders", {
    headers: { Authorization: `Bearer ${secret}` },
  });
  expect(second.status()).toBe(200);
  expect((await second.json()).logged).toBe(0);
  expect(errors).toEqual([]);
});
