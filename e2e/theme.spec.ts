import { test, expect } from "@playwright/test";

test("theme persists before content is painted and does not overflow", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("theme", "dark");
    const observer = new MutationObserver(() => {
      if (
        document.querySelector("main") &&
        !document.documentElement.dataset.firstContentTheme
      ) {
        document.documentElement.dataset.firstContentTheme =
          document.documentElement.dataset.theme;
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await page.goto("/design-check");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(
    page.getByRole("heading", { name: "Verifica interfaccia" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-first-content-theme",
    "dark",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Chiaro", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
