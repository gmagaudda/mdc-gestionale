import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const theme of ["light", "dark"])
  test(`login accessible in ${theme} theme`, async ({ page }) => {
    await page.addInitScript(
      (value) => localStorage.setItem("theme", value),
      theme,
    );
    await page.goto("/login");
    const audit = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(audit.violations).toEqual([]);
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  });
