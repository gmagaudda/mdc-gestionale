import { expect, type Page } from "@playwright/test";

export async function openUserMenu(page: Page) {
  const trigger = page.getByRole("button", { name: /^Menu utente di / });
  await expect(trigger).toBeVisible();
  if ((await trigger.getAttribute("aria-expanded")) !== "true")
    await trigger.click();
  // Arc changes from popover to sheet when crossing the compact breakpoint.
  // Wait for the exiting surface before interacting with the replacement.
  await expect(page.getByRole("menu")).toHaveCount(1);
  await expect(page.getByRole("menu")).toBeVisible();
}

export async function openAccountSettings(page: Page, label: string) {
  await openUserMenu(page);
  await page.getByRole("menuitem", { name: label, exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: label, exact: true }),
  ).toBeVisible();
  await expect(page.locator('[role="menu"]')).toHaveCount(0);
}

export async function setAppearance(page: Page, theme: string) {
  await openAccountSettings(page, "Aspetto");
  const dialog = page.getByRole("dialog", { name: "Aspetto", exact: true });
  await dialog.getByRole("button", { name: theme, exact: true }).click();
  await dialog.getByRole("button", { name: "Chiudi", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

export async function signOut(page: Page) {
  if (await page.getByRole("dialog").isVisible()) {
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Chiudi", exact: true })
      .click();
  }
  await openUserMenu(page);
  await page.getByRole("menuitem", { name: "Esci", exact: true }).click();
}
