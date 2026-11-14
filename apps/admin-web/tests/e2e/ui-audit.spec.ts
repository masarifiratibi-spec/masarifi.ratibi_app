import { expect, test } from "@playwright/test";

function contrast(first: string, second: string) {
  const luminance = (color: string) => {
    const rgb = color.startsWith("#")
      ? color.trim().slice(1).match(/../g)!.map(value => parseInt(value, 16))
      : color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const channels = rgb.map(value => {
      const component = value / 255;
      return component <= 0.04045 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("overview commands remain named, visible and reachable in both directions and themes", async ({ page }, testInfo) => {
  test.skip(!["desktop-1440", "tablet-768", "mobile-390"].includes(testInfo.project.name));
  await page.goto("/admin");
  for (const locale of ["ar", "en"]) {
    if (locale === "en") await page.locator(".topbar-actions > .icon-button").first().click();
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    for (const theme of ["light", "dark"]) {
      if (theme === "dark") await page.locator(".topbar-actions > .icon-button").nth(1).click();
      const exportButton = page.locator("[data-spec='overview-export']");
      await expect(exportButton).toHaveAccessibleName(locale === "ar" ? "تصدير CSV" : "Export CSV");
      await expect(exportButton.locator("span")).toBeVisible();
      const refresh = page.getByRole("button", { name: locale === "ar" ? "تحديث" : "Refresh", exact: true });
      await expect(refresh).toBeVisible();
      await expect(refresh.locator("span")).toBeVisible();
      const trend = page.locator(".trend.positive").first();
      await expect(trend).toBeVisible();
      const colors = await trend.evaluate(element => ({
        text: getComputedStyle(element).color,
        background: getComputedStyle(element).backgroundColor,
      }));
      expect(contrast(colors.text, colors.background)).toBeGreaterThanOrEqual(4.5);
      const statusColors = await page.evaluate(() => {
        const style = getComputedStyle(document.documentElement);
        return ["success", "warning", "danger", "info"].map(status => ({
          status,
          text: style.getPropertyValue(`--${status}`).trim(),
          background: style.getPropertyValue(`--${status}-soft`).trim(),
        }));
      });
      for (const colors of statusColors)
        expect(contrast(colors.text, colors.background), colors.status).toBeGreaterThanOrEqual(4.5);
      await refresh.focus();
      await expect(refresh).toBeFocused();
      const box = await refresh.boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
      if (testInfo.project.name === "mobile-390") {
        for (const control of await page.locator(".page-actions .segmented-control button, .page-actions .date-presets button").all()) {
          expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
    await page.locator(".topbar-actions > .icon-button").nth(1).click();
  }
});
