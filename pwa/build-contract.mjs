// Single producer for the facts shared by vite.config.ts (which builds the
// PWA) and scripts/check-pwa-build.mjs (which verifies the built output).
// Plain ESM with no imports so both Vite's config loader and bare `node` can
// import it.

/**
 * Vite `mode` → deployment base path. `mode` is the one switch that selects
 * a deployment: Vite's `base`, the manifest's id/start_url/scope, and the
 * checker's expectations all derive from it.
 * @type {Record<string, string>}
 */
export const BASE_BY_MODE = {
  production: "/", // `vite build`              → dist/    (release tarball, local server)
  "gh-pages": "/kidpix/", // `vite build --mode gh-pages` → dist-gh/ (GitHub Pages)
};

/** Output directories and the base each was built with. */
export const BUILD_TARGETS = [
  { outDir: "dist", base: BASE_BY_MODE.production },
  { outDir: "dist-gh", base: BASE_BY_MODE["gh-pages"] },
];

/**
 * Every deploy-owned runtime file type in the built output. Source maps are
 * intentionally absent (DevTools-only, see PRECACHE_EXEMPT). manifest.webmanifest
 * is added to the precache by vite-plugin-pwa itself; listing `webmanifest`
 * here too would produce a duplicate entry and invalidate the worker.
 */
export const PRECACHE_GLOB = "**/*.{js,css,html,png,gif,ico,svg,woff2,mp3,m4a,json}";

/**
 * Largest runtime file in the production output measured 2026-08-29: 413 KB
 * (assets/main-*.js). Workbox drops anything above this cap from the precache
 * and scripts/check-pwa-build.mjs then fails the build, so the cap is raised
 * deliberately instead of silently losing offline coverage.
 */
export const PRECACHE_MAX_FILE_BYTES = 1024 * 1024;

/**
 * Deployed files that are legitimately NOT in the precache. Anything else in
 * an output directory must be represented.
 */
export const PRECACHE_EXEMPT = [
  /^sw\.js$/, // the service worker itself (browser-managed)
  /^workbox-[^/]+\.js$/, // generateSW-style Workbox runtime, if ever emitted
  /\.map$/, // source maps: fetched only when DevTools opens, never by the app
];

/** Icons the manifest must carry (purpose "any" unless stated). */
export const REQUIRED_ICONS = [
  { sizes: "32x32" }, // favicon
  { sizes: "180x180" }, // Apple touch icon
  { sizes: "192x192" },
  { sizes: "512x512", purpose: "any" },
  { sizes: "512x512", purpose: "maskable" },
];

/**
 * Fewer precache entries than this means the build regressed to an
 * app-shell-only worker (the pre-2026-08-29 state precached 8 of ~400 files).
 */
export const PRECACHE_MIN_ENTRIES = 300;
