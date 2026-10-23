import { defineConfig } from "@playwright/test";

// Reuse the dev frontend. All API responses in this review are mocked.
process.env.STUDIO_TEST_API_URL ??= "http://127.0.0.1:3001";
process.env.STUDIO_TEST_ORIGIN ??= "http://127.0.0.1:3003";
process.env.STUDIO_UI_REVIEW_OUTPUT ??=
  "../social-media-studio-qa/.qa-runtime/ui-quality-2026-10-22/" +
  new Date().toISOString().replace(/[:.]/g, "-");

export default defineConfig({
  testDir: "./tests",
  workers: 1,
  fullyParallel: false,
  timeout: 30_000,
  reporter: "list",
  outputDir: process.env.STUDIO_UI_REVIEW_OUTPUT,
  use: {
    baseURL: process.env.STUDIO_TEST_ORIGIN,
    viewport: { width: 1440, height: 900 },
    channel: "chrome",
    headless: true,
    trace: "off",
    screenshot: "off",
    video: "off",
    serviceWorkers: "block",
  },
});
