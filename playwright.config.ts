import { defineConfig, devices } from "@playwright/test"

const password = process.env.APP_PASSWORD || "test-password"

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3100",
    httpCredentials: {
      username: "arc",
      password,
    },
    trace: "on-first-retry",
  },
  webServer: {
    command: "npx next start --hostname 127.0.0.1 --port 3100",
    env: {
      APP_PASSWORD: password,
    },
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    url: "http://127.0.0.1:3100",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
})
