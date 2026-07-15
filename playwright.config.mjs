import { defineConfig } from "@playwright/test";

const webPort = Number(process.env.WEB_PORT ?? 4200);
const apiPort = Number(process.env.PORT ?? 3000);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${webPort}/es`,
    trace: "retain-on-failure"
  },
  webServer: {
    command: "pnpm dev:i18n",
    url: `http://localhost:${webPort}/es/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      PORT: String(apiPort),
      WEB_PORT: String(webPort)
    }
  }
});
