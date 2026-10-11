import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
const password = "Local-users-test-42";
const ids: string[] = [];
let adminEmail: string;
let staffEmail: string;
const db = () =>
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
  for (const role of ["admin", "staff"] as const) {
    const email = `users-${role}-${crypto.randomUUID()}@example.test`;
    const result = await db().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (!result.data.user) throw Error("Fixture creation failed");
    ids.push(result.data.user.id);
    await db().from("profiles").update({ role }).eq("id", result.data.user.id);
    if (role === "admin") adminEmail = email;
    else staffEmail = email;
  }
});
test.afterAll(async () => {
  for (const id of ids) await db().auth.admin.deleteUser(id);
});
test("admin invites staff changes role and deactivates with an audit trail", async ({
  page,
}, testInfo) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(adminEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("link", { name: "Utenti", exact: true }).click();
  await page.getByRole("link", { name: "Invita utente" }).click();
  const email = `invited-${crypto.randomUUID()}@example.test`;
  await page.getByLabel("Nome e cognome").fill("Staff invitato");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByRole("button", { name: "Invita utente", exact: true })
    .click();
  await expect(page).toHaveURL(/\/settings\/users\/[\w-]+\?saved=1/);
  const id = new URL(page.url()).pathname.split("/").pop()!;
  ids.push(id);
  expect(
    (await db().from("profiles").select("role").eq("id", id).single()).data
      ?.role,
  ).toBe("staff");
  expect(
    (
      await db()
        .from("audit_log")
        .select("id")
        .eq("action", "invite")
        .eq("record_id", id)
    ).data?.length,
  ).toBe(1);
  await page.getByText("Amministrazione", { exact: true }).click();
  await page
    .getByRole("radio", { name: "Disattivato", exact: true })
    .press("Space");
  await page.getByRole("button", { name: "Salva utente", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Utente salvato");
  await expect
    .poll(
      async () =>
        (
          await db()
            .from("profiles")
            .select("role,is_active")
            .eq("id", id)
            .single()
        ).data,
    )
    .toMatchObject({ role: "accounting", is_active: false });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page
    .getByRole("link", { name: "Registro modifiche", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Registro modifiche", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("audit.png"),
    fullPage: true,
  });
});
test("staff cannot open users or invoke invitation endpoint", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(staffEmail);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("link", { name: "Utenti", exact: true }),
  ).toHaveCount(0);
  await page.goto("/settings/users");
  await expect(page.getByText("404", { exact: true })).toBeVisible();
  expect(
    (
      await page.request.post("/api/users/invite", {
        data: { email: "unauthorized@example.test" },
      })
    ).status(),
  ).toBe(403);
});
