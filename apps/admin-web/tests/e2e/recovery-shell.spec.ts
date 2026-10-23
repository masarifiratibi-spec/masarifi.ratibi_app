import { expect, test } from "@playwright/test";

test("recovery drawer traps keyboard focus and restores it after Escape", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile-390");
  await page.goto("/admin");
  const trigger = page.getByRole("button", { name: "فتح القائمة" });
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "التنقل الرئيسي" });
  await expect(drawer).toHaveAttribute("aria-modal", "true");
  await expect(page.locator(".admin-main")).toHaveAttribute("inert", "");
  await expect(
    drawer.getByRole("button", { name: "إغلاق القائمة" }),
  ).toBeFocused();
  for (let step = 0; step < 24; step++) {
    await page.keyboard.press(step % 3 === 0 ? "Shift+Tab" : "Tab");
    expect(
      await drawer.evaluate((element) =>
        element.contains(document.activeElement),
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator(".environment")).toBeVisible();
  await trigger.click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator(".admin-main")).not.toHaveAttribute("inert", "");
});

test("recovery shell keeps reporting dates scoped to the page", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop-1440");
  await page.goto("/admin");
  await expect(page.locator("main .date-range-control")).toHaveCount(1);
  await expect(page.locator(".topbar .date-range-control")).toHaveCount(0);
});
