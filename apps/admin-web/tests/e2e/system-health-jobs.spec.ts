import { expect, test } from "@playwright/test";

test("US1 operator scans health, ranges, freshness, and direction safely", async ({ page }, testInfo) => {
  await page.goto("/admin/system-health");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(/صحة النظام|System Health/);
  await expect(page.getByRole("button", { name: "1h" })).toBeVisible();
  await page.getByRole("button", { name: "7d" }).click();
  await expect(page).toHaveURL(/range=7d/);
  await expect(page.locator("[data-service-health-card]")).toHaveCount(12);
  await expect(page.locator("main")).toContainText(/Freshness|الحداثة/);

  if (testInfo.project.name === "mobile-390") {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }

  await page.getByRole("button", { name: "تغيير اللغة" }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("US2 operator reviews API database and storage diagnostics safely", async ({ page }) => {
  for (const [route, heading] of [
    ["/admin/system-health/api", "API Monitoring"],
    ["/admin/system-health/database", "Database Monitoring"],
    ["/admin/system-health/storage", "Storage Monitoring"],
  ] as const) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    await expect(page.locator("main")).toContainText(/Freshness|milliseconds|percent|Cleanup|Backup/);
    await expect(page.locator("body")).not.toContainText(/token|secret|select \*|filename|object key|signed url|checksum/i);
  }
});

test("US3 operator reviews provider health safely", async ({ page }, testInfo) => {
  await page.goto("/admin/system-health/providers");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Provider Health");
  await expect(page.getByRole("button", { name: "AI", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "AI", exact: true }).click();
  await expect(page.locator("main")).toContainText(/AI Providers|Fallback|Platform impact/);
  await expect(page.locator("body")).not.toContainText(/api key|token|secret|webhook|account id|request body|response body/i);
  if (testInfo.project.name === "mobile-390") {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("US4 operator reviews queue backlog and job detail safely", async ({ page }, testInfo) => {
  await page.goto("/admin/jobs/queues");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Queue Overview");
  await expect(page.locator("main")).toContainText(/Imports|Waiting|Retried/);

  await page.goto("/admin/jobs/runs");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Job Runs");
  await page.getByRole("link", { name: "JOB-DEMO-FAILED-01" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("JOB-DEMO-FAILED-01");
  await expect(page.locator("main")).toContainText(/Timeline|Correlation|Allowed actions/);
  await expect(page.locator("body")).not.toContainText(/payload|token|secret|customer|filename|select \*/i);
  if (testInfo.project.name === "mobile-390") {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("US5 operator retries an eligible job safely", async ({ page }) => {
  await page.goto("/admin/jobs/runs/JOB-DEMO-FAILED-01");
  await page.getByLabel("Action reason").fill("Retry after safe operator review.");
  await page.getByRole("button", { name: "Retry job" }).click();
  await expect(page.locator("main")).toContainText("Retry requested");
  await expect(page.locator("body")).not.toContainText(/payload|token|secret|customer|filename|select \*/i);
});

test("US6 operator reviews scheduled jobs read-only", async ({ page }, testInfo) => {
  await page.goto("/admin/jobs/scheduled");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Scheduled Jobs");
  await expect(page.locator("main")).toContainText(/Next run|Daily imports maintenance|Read-only/);
  await expect(page.locator("body")).not.toContainText(/run now|enable|disable|delete|edit|payload|token|secret/i);
  if (testInfo.project.name === "mobile-390") {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
