import { expect, test } from "@playwright/test";

test("desktop shell exposes approved operational controls", async ({ page }, testInfo) => {
  test.skip(
    ["tablet-768", "mobile-390"].includes(testInfo.project.name),
    "Desktop controls collapse below the approved 900px breakpoint.",
  );
  await page.goto("/admin");

  await expect(page.getByRole("navigation", { name: "التنقل الرئيسي" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "الدور التجريبي" })).toBeVisible();
  await expect(page.getByText("بيئة التطوير")).toBeVisible();
  await expect(page.getByRole("button", { name: "تبديل المظهر" })).toBeVisible();
  await expect(page.getByRole("button", { name: "تغيير اللغة" })).toBeVisible();
});

test("shell switches direction and theme without changing route content", async ({ page }) => {
  await page.goto("/admin");
  await page.getByRole("button", { name: "تغيير اللغة" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.getByRole("button", { name: "تبديل المظهر" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("mobile navigation opens and closes accessibly", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390", "Mobile drawer applies only to the 390px project.");
  await page.goto("/admin");

  const trigger = page.getByRole("button", { name: "فتح القائمة" });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "التنقل الرئيسي" })).toBeVisible();
  await page.getByRole("button", { name: "إغلاق القائمة" }).click();
  await expect(page.getByRole("dialog", { name: "التنقل الرئيسي" })).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("sidebar accordions toggle with mouse keyboard and active routes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Accordion interaction runs once on the reference desktop.");
  await page.goto("/admin/support/tickets/TKT-1001");

  const communications = page.getByRole("button", { name: "Communications" });
  const support = page.getByRole("button", { name: "Support" });
  await expect(communications).toHaveAttribute("aria-expanded", "true");
  await expect(support).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator('nav a[href="/admin/support/tickets/TKT-1001"]')).toHaveAttribute("aria-current", "page");

  await support.click();
  await expect(support).toHaveAttribute("aria-expanded", "false");
  await support.press("Enter");
  await expect(support).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Notifications" }).press(" ");
  await expect(page.getByRole("button", { name: "Notifications" })).toHaveAttribute("aria-expanded", "true");
  await expect(support).toHaveAttribute("aria-expanded", "false");

  await page.goto("/admin/jobs/runs");
  await expect(page.getByRole("button", { name: "System Health" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Jobs and Queues" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator('nav a[href="/admin/jobs/runs"]')).toHaveAttribute("aria-current", "page");
});

test("mobile drawer keeps accordion links usable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-390", "Mobile drawer behavior runs only on the 390px project.");
  await page.goto("/admin/notifications/campaigns/CMP-1001");
  await page.locator(".mobile-menu").click();

  const drawer = page.getByRole("dialog", { name: "التنقل الرئيسي" });
  await expect(drawer.getByRole("button", { name: "Communications" })).toHaveAttribute("aria-expanded", "true");
  await expect(drawer.getByRole("button", { name: "Notifications" })).toHaveAttribute("aria-expanded", "true");
  await drawer.locator('a[href="/admin/notifications/campaigns"]').click();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/\/admin\/notifications\/campaigns$/);
});

test("route scenarios expose explicit operational states without unsafe browser output", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Scenario matrix runs once on the reference desktop.");
  const browserErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  const cases = [
    ["success", "/admin", /صباح الخير/],
    ["loading", "/admin", /جارٍ تحميل/],
    ["empty", "/admin/users", /لا توجد نتائج/],
    ["internal-error", "/admin/imports", /تعذر تحميل/],
    ["partial", "/admin/system-health", /صحة النظام/],
    ["conflict", "/admin/imports", /تعذر تحميل/],
    ["forbidden", "/admin/users", /لا تملك صلاحية الوصول/],
    ["unavailable", "/admin/system-health", /تعذر تحميل/],
  ] as const;

  for (const [scenario, route, expectation] of cases) {
    await page.goto("/admin");
    await page.evaluate((value) => sessionStorage.setItem("admin-mock-scenario", value), scenario);
    await page.goto(route);
    await expect(page.locator("main")).toContainText(expectation);
  }

  await expect(page.locator("body")).not.toContainText(/secret-token|provider secret|C:\\private|raw payload/i);
  const unexpectedErrors = browserErrors.filter(
    (message) => !/^Failed to load resource: the server responded with a status of (403|409|500|503) /.test(message),
  );
  expect(unexpectedErrors).toEqual([]);
});
