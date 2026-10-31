import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const timingReporter = fileURLToPath(new URL("../../tests/e2e-runtime/timing-reporter.ts", import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  workers: 1,
  retries: process.env.E2E_RETRIES ? Number(process.env.E2E_RETRIES) : 1,
  timeout: 120_000,
  reporter: existsSync(timingReporter) ? [["list"], [timingReporter]] : [["list"]],
  use: { baseURL: "http://127.0.0.1:4329", browserName: "chromium", trace: "on-first-retry", screenshot: "only-on-failure" },
  webServer: {
    command: "sh e2e/server.sh",
    url: "http://127.0.0.1:4329/_emdash/admin",
    timeout: 180_000,
    reuseExistingServer: false,
  },
});
