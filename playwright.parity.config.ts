import { defineConfig, devices } from "@playwright/test";

/**
 * Parity-harness Playwright config (Phase 0 migration safety net).
 * Isolated from the main E2E config so golden baselines + threshold live here.
 * Chromium-only on purpose: cross-engine AA differences would defeat pixel parity.
 */
export default defineConfig({
  testDir: "./tests/parity",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "line",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  use: {
    baseURL: "http://localhost:5173",
    launchOptions: {
      args: [
        "--mute-audio",
        "--disable-audio-output",
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  projects: [
    {
      name: "chromium",
      // Viewport large enough that the pinned 1300x650 canvas isn't clipped by the
      // layout chrome (so the #kiddopaint screenshot is the full backing-size image).
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1700, height: 1000 },
      },
    },
  ],
  webServer: {
    command: "yarn dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
