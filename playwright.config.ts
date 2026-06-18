import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    // Disable audio to prevent sounds during testing
    launchOptions: {
      args: [
        "--mute-audio",
        "--disable-audio-output",
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
  },

  projects: [
    // Viewport overridden so the responsively-scaled canvas renders at >= its 1300x650
    // backing size; the tests hover at fixed positions that assume a full-size canvas.
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1700, height: 1000 },
        launchOptions: {
          // Auto-grant + fake the mic so MediaRecorder works in CI without a
          // physical device or a permission prompt (record-sound.spec.ts).
          args: [
            "--mute-audio",
            "--disable-audio-output",
            "--autoplay-policy=no-user-gesture-required",
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
          ],
        },
      },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1700, height: 1000 } },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], viewport: { width: 1700, height: 1000 } },
    },
  ],

  webServer: {
    command: "yarn dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
});
