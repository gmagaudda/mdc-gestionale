import type { Page } from "@playwright/test";
export async function navigateMenu(page: Page, label: string) {
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("link", { name: label, exact: true }).click();
}
