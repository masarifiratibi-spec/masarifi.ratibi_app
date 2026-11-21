import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/recovery",
  testMatch: "**/*.spec.ts",
  workers: 1,
  fullyParallel: false,
  outputDir:
    process.env.MASARIFI_RECOVERY_BROWSER_OUTPUT ??
    "../../.superpowers/sdd/2026-10-23-admin-dashboard-recovery/task-6-live-browser",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:43168",
    actionTimeout: 15_000,
    contextOptions: { reducedMotion: "reduce" },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-1440",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "desktop-1280",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "tablet-768",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "mobile-390",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: [
    {
      command:
        "node ../api/node_modules/ts-node/dist/bin.js --project ../api/tsconfig.json ../api/test/helpers/admin-recovery-browser.server.ts",
      env: {
        MASARIFI_RECOVERY_HTTP_TEST: "1",
        DATABASE_URL:
          "postgresql://postgres@127.0.0.1:55442/admin_recovery_browser",
      },
      url: "http://127.0.0.1:43169/__recovery/ready",
      reuseExistingServer: process.env.MASARIFI_RECOVERY_REUSE_API === "1",
      timeout: 90_000,
    },
    {
      command:
        "node node_modules/vite/bin/vite.js --config tests/recovery/vite.config.ts",
      url: "http://127.0.0.1:43168",
      reuseExistingServer: process.env.MASARIFI_RECOVERY_REUSE_WEB === "1",
      timeout: 90_000,
    },
  ],
});
