import { openUserMenu, setAppearance } from "./helpers/account";
import { completeAdminMfa } from "./helpers/mfa";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
const password = "Push-local-fixture-42";
let email: string,
  userId: string,
  fixture: {
    endpoint: string;
    expirationTime: null;
    keys: { p256dh: string; auth: string };
  };
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
  email = `push-${crypto.randomUUID()}@example.test`;
  const result = await db().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!result.data.user) throw Error("Fixture failed");
  userId = result.data.user.id;
  await db()
    .from("profiles")
    .update({ role: "staff", full_name: "Persona notifiche" })
    .eq("id", userId);
  const key = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  fixture = {
    endpoint: `https://fcm.googleapis.com/fcm/send/synthetic-${crypto.randomUUID()}`,
    expirationTime: null,
    keys: {
      p256dh: Buffer.from(
        await crypto.subtle.exportKey("raw", key.publicKey),
      ).toString("base64url"),
      auth: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
        "base64url",
      ),
    },
  };
});
test.afterAll(async () => {
  if (userId) await db().auth.admin.deleteUser(userId);
});
for (const denied of [false, true])
  test(`explicit consent and ${denied ? "blocked-browser revocation" : "device revocation"}`, async ({
    page,
    context,
  }, info) => {
    test.skip(
      process.env.E2E_PWA_PRODUCTION !== "1",
      "Push service worker runs only in production build.",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      ({ fixture, denied }) => {
        if (denied && !sessionStorage.getItem("push-denied-seeded")) {
          sessionStorage.setItem("push-fixture-active", "1");
          sessionStorage.setItem("push-denied-seeded", "1");
        }
        const state = {
          permissionCalls: 0,
          subscribeCalls: 0,
          unsubscribeCalls: 0,
        };
        Object.assign(window, { pushFixture: state });
        const fake = {
          endpoint: fixture.endpoint,
          toJSON: () => fixture,
          unsubscribe: async () => {
            state.unsubscribeCalls++;
            sessionStorage.removeItem("push-fixture-active");
            return true;
          },
        };
        // Synthetic browser push service only: no permission dialog and no outbound push.
        let permission = denied ? "denied" : "default";
        Object.defineProperty(window, "Notification", {
          configurable: true,
          value: {
            get permission() {
              return permission;
            },
            requestPermission: async () => {
              state.permissionCalls++;
              permission = "granted";
              return "granted";
            },
          },
        });
        Object.defineProperty(window, "PushManager", {
          configurable: true,
          value: function () {},
        });
        Object.defineProperty(navigator.serviceWorker, "getRegistration", {
          configurable: true,
          value: async () => ({
            active: {},
            pushManager: {
              getSubscription: async () =>
                sessionStorage.getItem("push-fixture-active") ? fake : null,
              subscribe: async () => {
                state.subscribeCalls++;
                sessionStorage.setItem("push-fixture-active", "1");
                return fake;
              },
            },
          }),
        });
      },
      { fixture, denied },
    );
    if (denied) {
      const result = await db()
        .from("push_subscriptions")
        .insert({
          user_id: userId,
          endpoint: fixture.endpoint,
          ...fixture.keys,
        });
      expect(result.error).toBeNull();
    }
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Accedi", exact: true }).click();
    await completeAdminMfa(page);
    await expect(page).toHaveURL(/dashboard$/);
    await openUserMenu(page);
    const toggle = page.getByRole("menuitemcheckbox", {
      name: "Notifiche",
      exact: true,
    });
    await expect(toggle).toHaveAttribute("aria-disabled", "false");
    await expect(toggle).toHaveAttribute("aria-checked", String(denied));
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { pushFixture: { permissionCalls: number } })
            .pushFixture.permissionCalls,
      ),
    ).toBe(0);
    if (!denied) {
      await context.setOffline(true);
      await expect(toggle).toHaveAttribute("aria-disabled", "true");
      await context.setOffline(false);
      await expect(toggle).toHaveAttribute("aria-disabled", "false");
      // Fail the first business write. No enabled state without server consent.
      await page.route("**/dashboard", (route) =>
        route.request().method() === "POST" &&
        route.request().headers()["next-action"]
          ? route.abort("failed")
          : route.continue(),
      );
      await toggle.click();
      await expect(
        page.getByRole("alert").filter({ hasText: "Notifiche non aggiornate" }),
      ).toBeVisible();
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      expect(
        (
          await db()
            .from("push_subscriptions")
            .select("id")
            .eq("user_id", userId)
        ).data,
      ).toHaveLength(0);
      await page.unroute("**/dashboard");
      await toggle.click();
      await expect(
        page.getByRole("alert").filter({ hasText: "Notifiche non aggiornate" }),
      ).toHaveCount(0);
      await expect(toggle).toHaveAttribute("aria-disabled", "false");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-checked", "true");
      await expect(
        page.getByText("Notifiche attivate su questo dispositivo.", {
          exact: true,
        }),
      ).toHaveCount(0);
      expect(
        (
          await db()
            .from("push_subscriptions")
            .select("id")
            .eq("user_id", userId)
        ).data,
      ).toHaveLength(1);
      const counts = await page.evaluate(
        () =>
          (
            window as unknown as {
              pushFixture: { permissionCalls: number; subscribeCalls: number };
            }
          ).pushFixture,
      );
      expect(counts).toMatchObject({ permissionCalls: 1, subscribeCalls: 1 });
      await page.reload();
      await openUserMenu(page);
      await expect(toggle).toHaveAttribute("aria-checked", "true");
      await expect(toggle).toHaveAttribute("aria-disabled", "false");
      expect(
        await page.evaluate(
          () =>
            (window as unknown as { pushFixture: { permissionCalls: number } })
              .pushFixture.permissionCalls,
        ),
      ).toBe(0);
    }
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(
      page.getByRole("dialog", { name: "Notifiche", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText(
        "Consenso revocato. Non riceverai altri promemoria su questo dispositivo.",
        { exact: true },
      ),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { pushFixture: { unsubscribeCalls: number } })
            .pushFixture.unsubscribeCalls,
      ),
    ).toBe(1);
    if (denied) await expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(
      (await db().from("push_subscriptions").select("id").eq("user_id", userId))
        .data,
    ).toHaveLength(0);
    const audit = await db()
      .from("audit_log")
      .select("before,after")
      .eq("actor_id", userId)
      .eq("table_name", "push_subscriptions");
    expect(JSON.stringify(audit.data)).not.toContain(fixture.endpoint);
    expect(JSON.stringify(audit.data)).not.toContain(fixture.keys.auth);
    for (const scheme of ["Chiaro", "Scuro"]) {
      await page.keyboard.press("Escape");
      await setAppearance(page, scheme);
      await openUserMenu(page);
      await page.waitForTimeout(400);
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
      path: info.outputPath("push-settings-dark.png"),
      fullPage: true,
    });
  });
