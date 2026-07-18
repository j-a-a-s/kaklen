import { defineConfig } from "@playwright/test";

const webPort = Number(process.env.WEB_PORT ?? 4200);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  actionTimeout: 15_000,
  workers: 1,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  retries: 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${webPort}/es`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  }
});
