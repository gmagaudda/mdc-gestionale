import type { Page } from "@playwright/test";
export async function navigateMenu(page: Page, label: string) {
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  const mobile = await menu.isVisible();
  if (mobile) await menu.click();
  // Expand the native disclosure containing the destination, if it is closed.
  const region = mobile
    ? page.getByRole("dialog", { name: "Menu", exact: true })
    : page.locator(".app-sidebar");
  const group = region.locator("details").filter({
    has: page.locator("a").filter({ hasText: new RegExp(`^${label}$`) }),
  });
  if ((await group.count()) && (await group.getAttribute("open")) === null)
    await group.locator("summary").click();
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
