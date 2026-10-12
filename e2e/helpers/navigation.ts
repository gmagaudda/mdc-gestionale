import type { Page } from "@playwright/test";
export async function navigateMenu(page: Page, label: string) {
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("link", { name: label, exact: true }).click();
}
// SearchSelect uses native options so long names remain selectable on touch.
export async function selectChoice(
  page: Page,
  label: string,
  option: string,
  partial = false,
) {
  const control = page.getByRole("combobox", { name: label, exact: true });
  if (await control.evaluate((element) => element.tagName === "SELECT")) {
    const item = partial
      ? control.locator("option").filter({ hasText: option })
      : control.getByRole("option", { name: option, exact: true });
    const value = await item.getAttribute("value");
    if (value === null) throw Error("Option missing");
    await control.selectOption(value);
  } else {
    await control.click();
    const item = partial
      ? page.getByRole("option").filter({ hasText: option })
      : page.getByRole("option", { name: option, exact: true });
    await item.click();
  }
}
