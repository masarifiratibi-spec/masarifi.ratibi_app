import { expect, test } from "@playwright/test";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Spec 002 overview journeys run once on the reference desktop.");
});

test("overview switches combined, iOS, and Android analytics without summing unique customers", async ({ page }) => {
  await page.goto("/admin");

  await expect(page.locator("[data-spec='unique-customers-total']")).toContainText("128,450");
  await expect(page.locator("[data-spec='overlap-warning']")).toBeVisible();
  await expect(page.locator("[data-spec='global-health-label']")).toContainText("Global");

  await page.getByRole("button", { name: "iOS" }).click();
  await expect(page.locator("[data-spec='unique-customers-total']")).toContainText("71,150");
  await expect(page.locator("[data-spec='adoption-summary']")).toContainText("Shortcut");
  await expect(page.locator("[data-spec='adoption-summary']")).toContainText("Share Extension");
  await expect(page.locator("[data-spec='global-health-label']")).toContainText("Global");

  await page.getByRole("button", { name: "Android" }).click();
  await expect(page.locator("[data-spec='unique-customers-total']")).toContainText("62,250");
  await expect(page.locator("[data-spec='adoption-summary']")).toContainText("SMS Tracking");
  await expect(page.locator("[data-spec='adoption-summary']")).toContainText("Notification Listener");
  await expect(page.locator("[data-spec='global-health-label']")).toContainText("Global");
});

test("activity pagination is bounded and resets when the platform changes", async ({ page }) => {
  await page.goto("/admin");

  await expect(page.locator("[data-spec='activity-page']")).toContainText("1");
  await page.locator("[data-spec='activity-load-more']").click();
  await expect(page.locator("[data-spec='activity-page']")).toContainText("2");

  await page.getByRole("button", { name: "Android" }).click();
  await expect(page.locator("[data-spec='activity-page']")).toContainText("1");
});
