import { test, expect } from "@playwright/test";
test("login attempts have a persistent identity limit", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Security gate on desktop");
  test.setTimeout(90000);
  const response = await page.goto("/login");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  if (process.env.E2E_SECURITY_PRODUCTION === "1")
    expect(response?.headers()["content-security-policy"]).not.toContain(
      "unsafe-eval",
    );
  const email = `rate-${crypto.randomUUID()}@example.test`;
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("invalid-password");
  for (let i = 0; i < 11; i++) {
    const button = page.getByRole("button", { name: "Accedi", exact: true });
    await button.click();
    await expect(page.locator("form").getByRole("alert")).toBeVisible();
    await expect(button).toBeEnabled();
  }
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "Troppi tentativi",
  );
  await page.reload();
  await page.getByLabel("Email", { exact: true }).fill(email.toUpperCase());
  await page.getByLabel("Password", { exact: true }).fill("invalid-password");
  await page.getByRole("button", { name: "Accedi", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText(
    "Troppi tentativi",
  );
});
test("public feed returns 429 and Retry-After without trusting forwarded IP", async ({
  request,
}, info) => {
  test.skip(info.project.name !== "desktop", "Security gate on desktop");
  test.setTimeout(90000);
  const token = crypto.randomUUID().replaceAll("-", "").repeat(2);
  for (let i = 0; i < 60; i++) {
    const response = await request.get(`/api/ical/${token}`, {
      headers: { "X-Forwarded-For": `192.0.2.${i}` },
    });
    expect(response.status()).toBe(404);
  }
  const limited = await request.get(`/api/ical/${token}`, {
    headers: { "X-Forwarded-For": "198.51.100.1" },
  });
  expect(limited.status()).toBe(429);
  expect(Number(limited.headers()["retry-after"])).toBeGreaterThan(0);
  expect(limited.headers()["cache-control"]).toBe("private, no-store");
});
