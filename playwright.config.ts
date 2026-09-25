import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const localServer = /^http:\/\/(127\.0\.0\.1|localhost):3000/.test(baseURL);
const serverCommand = process.env.E2E_USE_PRODUCTION_SERVER === "1"
  ? "npm run start -- --hostname 127.0.0.1"
  : "npm run dev -- --hostname 127.0.0.1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    viewport: { width: 375, height: 812 },
    trace: "retain-on-failure",
  },
  webServer: localServer
    ? {
        command: serverCommand,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
