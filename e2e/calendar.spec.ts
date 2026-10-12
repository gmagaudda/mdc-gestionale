import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
const password = "Calendar-local-test-42";
let email: string, userId: string, brandId: string, eventId: string;
const brandName = `Calendario ${crypto.randomUUID()}`;
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
  email = `calendar-${crypto.randomUUID()}@example.test`;
  const user = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  userId = user.data.user!.id;
  await admin()
    .from("profiles")
    .update({ role: "staff", full_name: "Persona calendario" })
    .eq("id", userId);
  brandId = (
    await admin()
      .from("brands")
      .insert({ name: brandName })
      .select("id")
      .single()
  ).data!.id;
});
test.afterAll(async () => {
  if (userId) await admin().from("events").delete().eq("assigned_to", userId);
  if (brandId) await admin().from("brands").delete().eq("id", brandId);
  if (userId) await admin().auth.admin.deleteUser(userId);
});
test("creates edits moves filters and archives events with accessible mobile controls", async ({
  page,
}, info) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Esci", exact: true }),
  ).toBeVisible();
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.goto("/calendar");
  await expect(
    page.getByRole("heading", { name: "Calendario", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Vista calendario" }),
  ).toContainText(
    info.project.name === "desktop" || info.project.name === "laptop"
      ? "Mese"
      : "Lista",
  );
  await page.getByRole("button", { name: "Nuovo evento", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Titolo", { exact: true })
    .fill("Appuntamento campionario prova");
  const initial = await dialog
    .getByLabel("Inizio", { exact: true })
    .inputValue();
  const date = initial.slice(0, 10);
  await dialog
    .getByRole("checkbox", { name: "Visibile al brand", exact: true })
    .check();
  await dialog
    .getByRole("button", { name: "Salva evento", exact: true })
    .click();
  await expect(dialog.locator("#event-brand_id-description")).toBeVisible();
  await expect(
    dialog.getByRole("combobox", { name: "Brand", exact: true }),
  ).toBeFocused();
  await dialog
    .getByRole("searchbox", { name: "Cerca Brand", exact: true })
    .fill(brandName);
  await dialog
    .getByRole("combobox", { name: "Brand", exact: true })
    .selectOption({ label: brandName });
  await dialog.getByLabel("Luogo", { exact: true }).fill("Showroom Milano");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await dialog
    .getByRole("button", { name: "Salva evento", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText("Evento aggiornato.", { exact: true }),
  ).toBeVisible();
  const row = (
    await admin().from("events").select("*").eq("assigned_to", userId).single()
  ).data!;
  eventId = row.id;
  expect(row.starts_at).toContain("T07:00:00");
  expect(row.visible_to_brand).toBe(true);
  const event = page
    .locator(`[data-event-id="${eventId}"]`)
    .filter({ visible: true })
    .first();
  await expect(event).toBeVisible();
  await event.focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Inizio", { exact: true }).fill(`${date}T11:00`);
  await dialog.getByLabel("Fine", { exact: true }).fill(`${date}T12:00`);
  await dialog
    .getByRole("button", { name: "Salva evento", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  expect(
    (
      await admin()
        .from("events")
        .select("starts_at")
        .eq("id", eventId)
        .single()
    ).data!.starts_at,
  ).toContain("T09:00:00");
  await expect(page.locator(".calendar-surface")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  if (info.project.name === "desktop" || info.project.name === "laptop") {
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    const targetDate = next.toISOString().slice(0, 10);
    const target = page
      .locator(`[data-date="${targetDate}"]`)
      .filter({ visible: true })
      .first();
    await event.scrollIntoViewIfNeeded();
    const from = await event.boundingBox();
    const to = await target.boundingBox();
    await page.mouse.move(from!.x + 15, from!.y + 15);
    await page.mouse.down();
    await page.mouse.move(to!.x + 25, to!.y + 50, { steps: 20 });
    await page.mouse.up();
    await expect
      .poll(
        async () =>
          (
            await admin()
              .from("events")
              .select("starts_at")
              .eq("id", eventId)
              .single()
          ).data!.starts_at,
      )
      .toContain(targetDate);
  }
  await page.locator("summary").filter({ hasText: "Filtri eventi" }).click();
  await page.getByRole("combobox", { name: "Tipo", exact: true }).click();
  await page.getByRole("option", { name: "Consegna", exact: true }).click();
  await expect(event).toHaveCount(0);
  await page.getByRole("combobox", { name: "Tipo", exact: true }).click();
  await page.getByRole("option", { name: "Tutti i tipi", exact: true }).click();
  await expect(event).toBeVisible();
  await page.locator("summary").filter({ hasText: "Filtri eventi" }).click();
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
  await event.click();
  await dialog
    .getByRole("checkbox", { name: "Tutto il giorno", exact: true })
    .check();
  const allDate = await dialog
    .getByLabel("Inizio", { exact: true })
    .inputValue();
  await dialog.getByLabel("Ultimo giorno", { exact: true }).fill("");
  await dialog
    .getByRole("button", { name: "Salva evento", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Ultimo giorno", { exact: true }).fill(allDate);
  await dialog
    .getByRole("button", { name: "Salva evento", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".calendar-surface")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const allDay = (
    await admin()
      .from("events")
      .select("all_day,starts_at,ends_at")
      .eq("id", eventId)
      .single()
  ).data!;
  expect(allDay.all_day).toBe(true);
  expect(Date.parse(allDay.ends_at) - Date.parse(allDay.starts_at)).toBe(
    86400000,
  );
  await page
    .locator("summary")
    .filter({ hasText: "Preferenze utente" })
    .click();
  await page.getByRole("button", { name: "Scuro", exact: true }).click();
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath("calendar.png"),
    fullPage: true,
  });
  await event.click();
  await dialog
    .getByRole("button", { name: "Archivia evento", exact: true })
    .click();
  const confirm = page.getByRole("dialog", {
    name: "Archivia evento",
    exact: true,
  });
  await expect(
    confirm.getByRole("button", { name: "Annulla", exact: true }),
  ).toBeFocused();
  await confirm
    .getByRole("button", { name: "Archivia evento", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(event).toHaveCount(0);
  expect(browserErrors).toEqual([]);
  expect(
    (
      await page.request.get(
        `/api/calendar?start=${date}T00:00:00Z&end=${date}T00:00:00Z`,
      )
    ).status(),
  ).toBe(400);
});
