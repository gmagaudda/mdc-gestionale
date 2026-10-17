import type { Page } from "@playwright/test";
import { navigationForRole } from "../../lib/navigation";
import messages from "../../messages/it.json";
export async function navigateMenu(page: Page, label: string) {
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  const mobile = await menu.isVisible();
  if (mobile) await menu.click();
  // Expand the disclosure containing the destination, if it is closed.
  const region = mobile
    ? page.getByRole("dialog", { name: "Menu", exact: true })
    : page.locator(".app-sidebar");
  // Closed animated submenus unmount their links. Resolve their group from
  // the role-aware navigation definitions instead of inspecting hidden DOM.
  const groups = ["admin", "staff", "accounting", "brand"] as const;
  const group = groups
    .flatMap((role) => navigationForRole(role).groups)
    .find((item) =>
      item.links.some(
        (link) =>
          messages.common[link.label as keyof typeof messages.common] === label,
      ),
    );
  if (group) {
    const groupLabel =
      messages.common[group.label as keyof typeof messages.common];
    if (typeof groupLabel !== "string")
      throw Error("Navigation group label missing");
    const trigger = region.getByRole("button", {
      name: groupLabel,
      exact: true,
    });
    if (
      (await trigger.isVisible()) &&
      (await trigger.getAttribute("aria-expanded")) === "false"
    )
      await trigger.click();
  }
  await page.getByRole("link", { name: label, exact: true }).click();
}
// Support native selects, Arc selects, and searchable Arc comboboxes.
export async function selectChoice(
  page: Page,
  label: string,
  option: string,
  partial = false,
) {
  const toolbar = page.locator(".list-toolbar");
  if (await toolbar.locator(".table-filter-toolbar").count()) {
    await toolbar
      .getByRole("button", { name: "Aggiungi filtro", exact: true })
      .click();
    await page
      .getByRole("menuitem", { name: new RegExp(`^${label}(?:$|\\s)`) })
      .click();
    const item = partial
      ? page.getByRole("menuitemradio").filter({ hasText: option })
      : page.getByRole("menuitemradio", { name: option, exact: true });
    if (
      await page
        .getByRole("menuitemradio", {
          name: "Cerca altri valori…",
          exact: true,
        })
        .count()
    ) {
      await page
        .getByRole("menuitemradio", {
          name: "Cerca altri valori…",
          exact: true,
        })
        .click();
      const input = page
        .getByRole("dialog", { name: label, exact: true })
        .getByRole("combobox");
      await input.fill(option.split(" · ")[0]);
      await page
        .getByRole("option", {
          name: partial ? new RegExp(option) : option,
          exact: !partial,
        })
        .click();
    } else await item.click();
    return;
  }
  const trigger = page.getByRole("button", {
    name: new RegExp(`^${label}(?::|$)`),
  });
  if (
    !(await page.getByRole("combobox", { name: label, exact: true }).count()) &&
    (await trigger.count())
  )
    await trigger.click();
  const control = page.getByRole("combobox", { name: label, exact: true });
  if (await control.evaluate((element) => element.tagName === "SELECT")) {
    const item = partial
      ? control.locator("option").filter({ hasText: option })
      : control.getByRole("option", { name: option, exact: true });
    const value = await item.getAttribute("value");
    if (value === null) throw Error("Option missing");
    await control.selectOption(value);
  } else {
    if (await control.evaluate((element) => element.tagName === "INPUT")) {
      await control.focus();
      const typed = await control.inputValue();
      if (!typed || !option.includes(typed))
        await control.fill(option.split(" · ")[0]);
    } else await control.click();
    const item = partial
      ? page.getByRole("option").filter({ hasText: option })
      : page.getByRole("option", { name: option, exact: true });
    await item.click();
  }
}
