import type { Database } from "@/lib/supabase/types";
import { test, expect } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const password = "Local-test-password-42";
let email: string;
let id: string;
let brandEmail: string;
let brandId: string;
let admin: SupabaseClient<Database>;
test.beforeAll(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
    throw new Error("E2E fixtures require local Supabase");
  admin = createClient<Database>(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  email = `staff-${crypto.randomUUID()}@example.test`;
  brandEmail = `brand-${crypto.randomUUID()}@example.test`;
  const staff = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Staff di prova" },
  });
  if (staff.error || !staff.data.user)
    throw new Error("Could not create local test identity");
  id = staff.data.user.id;
  const profile = await admin
    .from("profiles")
    .update({ role: "staff" })
    .eq("id", id);
  if (profile.error) throw profile.error;
  const brand = await admin.auth.admin.createUser({
    email: brandEmail,
    password,
    email_confirm: true,
  });
  if (brand.error || !brand.data.user)
    throw new Error("Could not create local brand identity");
  brandId = brand.data.user.id;
});
test.afterAll(async () => {
  if (id) await admin.auth.admin.deleteUser(id);
  if (brandId) await admin.auth.admin.deleteUser(brandId);
});

test("invalid credentials show a recoverable error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("invalid-password");
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "Email o password non corrette",
  );
});
test("staff signs in and out with no horizontal overflow", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: "Panoramica showroom" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Esci", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});
test("brand cannot enter internal routes", async ({ page }) => {
  await page.goto("/login?next=/dashboard");
  await page.getByLabel("Email", { exact: true }).fill(brandEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/\/portal\/dashboard$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/portal\/dashboard$/);
});
test("inactive account is denied", async ({ page }) => {
  await admin.from("profiles").update({ is_active: false }).eq("id", id);
  try {
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Accedi", exact: true }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText(
      "Account non attivo",
    );
  } finally {
    await admin.from("profiles").update({ is_active: true }).eq("id", id);
  }
});
test("reset email verifies session and changes password", async ({
  page,
  request,
}) => {
  await page.goto("/reset-password");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Invia link di recupero" }).click();
  await expect(page.getByRole("status")).toContainText("riceverai un’email");
  let messageId: string | undefined;
  await expect
    .poll(async () => {
      const response = await request.get(
        "http://127.0.0.1:54324/api/v1/messages",
      );
      const body = await response.json();
      const message = body.messages?.find(
        (item: { To: { Address: string }[]; ID: string }) =>
          item.To.some((recipient) => recipient.Address === email),
      );
      messageId = message?.ID;
      return Boolean(messageId);
    })
    .toBe(true);
  const message = await (
    await request.get(`http://127.0.0.1:54324/api/v1/message/${messageId}`)
  ).json();
  const link = message.HTML.match(/href="([^"]+)"/)?.[1]?.replaceAll(
    "&amp;",
    "&",
  );
  expect(link).toBeTruthy();
  await page.goto(link);
  expect(new URL(page.url()).origin).toBe(
    new URL(process.env.E2E_BASE_URL ?? "http://localhost:3100").origin,
  );
  await expect(page).toHaveURL(/\/reset-password\?mode=new/);
  const updated = "New-local-password-43";
  await page.getByLabel("Nuova password", { exact: true }).fill(updated);
  await page.getByLabel("Conferma password", { exact: true }).fill(updated);
  await page.getByRole("button", { name: "Salva password" }).click();
  await expect(page).toHaveURL(/\/login\?password=updated/);
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  expect(
    (await client.auth.signInWithPassword({ email, password: updated })).error,
  ).toBeNull();
  await admin.auth.admin.updateUserById(id, { password });
});
