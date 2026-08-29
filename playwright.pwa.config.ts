import { defineConfig, devices } from "@playwright/test";

/**
 * Offline-PWA Playwright config. Tests the REAL production artifacts in
 * dist/ and dist-gh/ (run `yarn build` first), not the dev server, so there
 * is no `webServer` here: each test starts its own static server for one
 * build directory and closes it to go offline.
 *
 * Chromium-only on purpose: it is the engine with dependable service-worker
 * support under Playwright. Set KIDPIX_CHROMIUM to a system Chromium binary
 * when Playwright's bundled browser cannot launch (NixOS).
 */
export default defineConfig({
  testDir: "./tests/pwa",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: "line",
  timeout: 90_000,
  use: {
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.KIDPIX_CHROMIUM || undefined,
      args: ["--mute-audio", "--disable-audio-output", "--autoplay-policy=no-user-gesture-required"],
    },
  },
  projects: [
    {
      name: "chromium",
      // Same viewport as the main E2E config: the tests draw at fixed canvas positions.
      use: { ...devices["Desktop Chrome"], viewport: { width: 1700, height: 1000 } },
    },
  ],
});
