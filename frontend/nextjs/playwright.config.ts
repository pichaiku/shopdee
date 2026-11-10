import { defineConfig, devices } from "@playwright/test";

/**
 * Where the storefront under test runs:
 *   - default: the Docker stack behind nginx (docker compose up -d)  -> http://localhost
 *   - local dev server: PLAYWRIGHT_BASE_URL=http://localhost:3000 PLAYWRIGHT_START_SERVER=1 npx playwright test
 * PLAYWRIGHT_SLOWMO=500 slows every action down (handy with --headed for demos).
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost";
const START_SERVER = process.env.PLAYWRIGHT_START_SERVER === "1";
const SLOWMO = Number(process.env.PLAYWRIGHT_SLOWMO ?? 0);

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["line"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "th-TH",
    launchOptions: {
      slowMo: SLOWMO,
      args: ["--disable-features=Translate,TranslateUI,TranslateService", "--disable-translate"],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: START_SERVER
    ? {
        command: "npm run dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      }
    : undefined,
});
