import { defineConfig, devices } from "@playwright/test";

const common = {
  baseURL: "https://localhost:8443",
  ignoreHTTPSErrors: true, // Self-signed certificate on disposable CI instance.
};

export default defineConfig({
  testDir: "./tests",
  timeout: 40_000,
  expect: { timeout: 12_000, toHaveScreenshot: { maxDiffPixelRatio: 0.008 } },
  fullyParallel: false,
  workers: 1, // One disposable IdP with shared fixture accounts.
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    ...common,
    actionTimeout: 15_000,
    navigationTimeout: 25_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-light",
      use: {
        ...devices["Desktop Chrome"],
        ...common,
        viewport: { width: 1440, height: 900 },
        colorScheme: "light",
      },
    },
    {
      name: "desktop-dark",
      use: {
        ...devices["Desktop Chrome"],
        ...common,
        viewport: { width: 1440, height: 900 },
        colorScheme: "dark",
      },
    },
    {
      name: "mobile-light",
      use: {
        ...devices["Pixel 7"],
        ...common,
        colorScheme: "light",
        defaultBrowserType: "chromium",
      },
    },
    {
      name: "mobile-dark",
      use: {
        ...devices["Pixel 7"],
        ...common,
        colorScheme: "dark",
        defaultBrowserType: "chromium",
      },
    },
  ],
});
