import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    exclude: ["**/node_modules/**", "**/tests/e2e/**"],
    // Include JavaScript files from js/ directory
    include: ["**/*.{test,spec}.{js,ts,tsx}", "**/js/**/*.{test,spec}.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "coverage/**",
        "dist/**",
        "**/node_modules/**",
        "**/*.d.ts",
        "**/*.config.{js,ts}",
        "**/*.test.{js,ts}",
        "**/*.spec.{js,ts}",
        "tests/**",
        "site/**",
      ],
      include: ["js/**/*.js", "src/**/*.{js,ts,tsx}"],
      all: true,
      // TODO: Increase coverage thresholds as we add more tests
      // Current coverage (as of 2025-06-17): ~1.76% lines, ~14.96% functions, ~25% branches
      // Target coverage goals: 70% lines, 70% functions, 60% branches, 70% statements
      // Thresholds reset to 0 after removing the React skeleton (ADR-0001), whose
      // component tests supplied most covered functions. Raise as the TS core/ grows tests.
      thresholds: {
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
    },
  },
});
