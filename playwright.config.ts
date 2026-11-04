import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
  },
})
