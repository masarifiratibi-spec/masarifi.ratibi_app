import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const port = Number(process.env.MASARIFI_ADMIN_RECOVERY_PORT ?? "43167");
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  ...base,
  expect: { timeout: 10_000 },
  outputDir:
    process.env.MASARIFI_RECOVERY_BROWSER_OUTPUT ??
    "../../.superpowers/sdd/2026-10-23-admin-dashboard-recovery/task-6-shell-browser",
  use: { ...base.use, baseURL },
  webServer: {
    command: `node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port ${port}`,
    env: {
      CLERK_SECRET_KEY: "",
      NEXT_PUBLIC_API_URL: "",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
      NEXT_PUBLIC_ENABLE_MOCKS: "true",
      NEXT_PUBLIC_CLIENT_MODE: "test",
    },
    url: `${baseURL}/admin`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
