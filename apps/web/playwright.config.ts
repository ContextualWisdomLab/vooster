import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e-web",
  webServer: {
    command: "pnpm --filter @vooster/web dev --hostname 127.0.0.1 --port 3108",
    env: {
      VSPEC_AUTH_STUB: "1"
    },
    reuseExistingServer: !process.env.CI,
    url: "http://127.0.0.1:3108"
  },
  use: {
    baseURL: "http://127.0.0.1:3108",
    trace: "on-first-retry"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
