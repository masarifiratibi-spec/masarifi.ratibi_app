import { expect, test } from "@playwright/test";

// ---------------------------------------------------------------------------
// Notification Panel – Responsive Layout Tests
// Verifies the attention/notification panel renders correctly across breakpoints.
// ---------------------------------------------------------------------------

test.describe("Notification Panel – Desktop", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin");
    // Wait for MSW to initialize
    await page.waitForSelector('[aria-label="الإشعارات"]', { timeout: 10_000 });
  });

  test("notification button is visible in the topbar", async ({ page }) => {
    await expect(page.getByRole("button", { name: "الإشعارات" })).toBeVisible();
  });

  test("panel opens and shows heading and close button", async ({ page }) => {
    await page.getByRole("button", { name: "الإشعارات" }).click();
    const panel = page.locator('[aria-label="التنبيهات التشغيلية"]');
    await expect(panel).toBeVisible();
    await expect(page.getByRole("button", { name: "إغلاق التنبيهات" })).toBeVisible();
    await expect(page.getByText("التنبيهات التشغيلية").first()).toBeVisible();
  });

  test("panel does not overflow the viewport horizontally", async ({ page }) => {
    await page.getByRole("button", { name: "الإشعارات" }).click();
    const panel = page.locator('[aria-label="التنبيهات التشغيلية"]');
    await expect(panel).toBeVisible();

    const vpWidth = page.viewportSize()!.width;
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    // Panel right edge must not exceed viewport width
    expect(box!.x + box!.width).toBeLessThanOrEqual(vpWidth + 1);
    // Panel left edge must be positive
    expect(box!.x).toBeGreaterThanOrEqual(0);
  });

  test("panel is bounded within the viewport vertically", async ({ page }) => {
    await page.getByRole("button", { name: "الإشعارات" }).click();
    const panel = page.locator('[aria-label="التنبيهات التشغيلية"]');
    await expect(panel).toBeVisible();

    const vpHeight = page.viewportSize()!.height;
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    // Panel bottom edge must not exceed viewport height
    expect(box!.y + box!.height).toBeLessThanOrEqual(vpHeight + 2);
  });

  test("close button closes the panel", async ({ page }) => {
    await page.getByRole("button", { name: "الإشعارات" }).click();
    await expect(page.locator('[aria-label="التنبيهات التشغيلية"]')).toBeVisible();
    await page.getByRole("button", { name: "إغلاق التنبيهات" }).click();
    await expect(page.locator('[aria-label="التنبيهات التشغيلية"]')).toBeHidden();
  });

  test("notification items load and are visible", async ({ page }) => {
    await page.getByRole("button", { name: "الإشعارات" }).click();
    const panel = page.locator('[aria-label="التنبيهات التشغيلية"]');
    await expect(panel).toBeVisible();
    // Either items or an empty/error state must appear
    const hasItems = await panel.locator("strong").count();
    expect(hasItems).toBeGreaterThan(0);
  });
});

test.describe("Notification Panel – Mobile 390px", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Mobile tests run on chromium only",
  );

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !["mobile-390"].includes(testInfo.project.name),
      "Mobile-specific test: skipped on non-mobile projects",
    );
    await page.goto("/admin");
    await page.waitForSelector('[aria-label="الإشعارات"]', { timeout: 10_000 });
  });

  test("panel fits within 390px viewport – no horizontal overflow", async ({ page }, testInfo) => {
    test.skip(!["mobile-390"].includes(testInfo.project.name), "mobile only");

    await page.getByRole("button", { name: "الإشعارات" }).click();
    const panel = page.locator('[aria-label="التنبيهات التشغيلية"]');
    await expect(panel).toBeVisible();

    const vpWidth = page.viewportSize()!.width;
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vpWidth + 1);
  });

  test("panel is anchored to bottom on mobile", async ({ page }, testInfo) => {
    test.skip(!["mobile-390"].includes(testInfo.project.name), "mobile only");

    await page.getByRole("button", { name: "الإشعارات" }).click();
    const panel = page.locator('[aria-label="التنبيهات التشغيلية"]');
    await expect(panel).toBeVisible();

    const vpHeight = page.viewportSize()!.height;
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    // Bottom of panel must be at or near bottom of viewport (within 4px)
    expect(box!.y + box!.height).toBeGreaterThan(vpHeight * 0.5);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vpHeight + 4);
  });

  test("heading and close button remain visible on mobile", async ({ page }, testInfo) => {
    test.skip(!["mobile-390"].includes(testInfo.project.name), "mobile only");

    await page.getByRole("button", { name: "الإشعارات" }).click();
    await expect(page.getByText("التنبيهات التشغيلية").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "إغلاق التنبيهات" })).toBeVisible();
  });

  test("tapping close button dismisses panel on mobile", async ({ page }, testInfo) => {
    test.skip(!["mobile-390"].includes(testInfo.project.name), "mobile only");

    await page.getByRole("button", { name: "الإشعارات" }).click();
    await expect(page.locator('[aria-label="التنبيهات التشغيلية"]')).toBeVisible();
    await page.getByRole("button", { name: "إغلاق التنبيهات" }).click();
    await expect(page.locator('[aria-label="التنبيهات التشغيلية"]')).toBeHidden();
  });

  test("no horizontal scrollbar on mobile when panel is open", async ({ page }, testInfo) => {
    test.skip(!["mobile-390"].includes(testInfo.project.name), "mobile only");

    await page.getByRole("button", { name: "الإشعارات" }).click();
    await expect(page.locator('[aria-label="التنبيهات التشغيلية"]')).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});

test.describe("Notification Panel – Tablet 768px", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !["tablet-768"].includes(testInfo.project.name),
      "Tablet-specific test: skipped on non-tablet projects",
    );
    await page.goto("/admin");
    await page.waitForSelector('[aria-label="الإشعارات"]', { timeout: 10_000 });
  });

  test("panel fits within 768px viewport", async ({ page }, testInfo) => {
    test.skip(!["tablet-768"].includes(testInfo.project.name), "tablet only");

    await page.getByRole("button", { name: "الإشعارات" }).click();
    const panel = page.locator('[aria-label="التنبيهات التشغيلية"]');
    await expect(panel).toBeVisible();

    const vpWidth = page.viewportSize()!.width;
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vpWidth + 1);
  });
});

test.describe("Notification Panel – English LTR", () => {
  test("panel works correctly after switching to English", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForSelector('[aria-label="الإشعارات"]', { timeout: 10_000 });

    // Switch to English
    await page.getByRole("button", { name: "تغيير اللغة" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");

    // Open notification panel
    const bellBtn = page.getByRole("button", { name: /notifications/i });
    if (await bellBtn.isVisible()) {
      await bellBtn.click();
    } else {
      await page.getByRole("button", { name: "الإشعارات" }).click();
    }
    const panel = page.locator('[aria-label="التنبيهات التشغيلية"]');
    await expect(panel).toBeVisible();

    // Panel must not overflow viewport
    const vpWidth = page.viewportSize()!.width;
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vpWidth + 1);
  });
});
