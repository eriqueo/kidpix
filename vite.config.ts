import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { BASE_BY_MODE, PRECACHE_GLOB, PRECACHE_MAX_FILE_BYTES } from "./pwa/build-contract.mjs";

function legalFilesPlugin(): Plugin {
  return {
    name: "kidpix-legal-files",
    generateBundle() {
      for (const [sourceName, outputName] of [
        ["LICENSE", "LICENSE.txt"],
        ["NOTICE", "NOTICE.txt"],
      ]) {
        this.emitFile({
          type: "asset",
          fileName: outputName,
          source: readFileSync(new URL(sourceName, import.meta.url)),
        });
      }
    },
  };
}

// React was removed (ADR-0001); the app is the legacy engine loaded via
// src/kidpix-main.js. New work is plain TS under core/ ports/ adapters/.
//
// Deployment bases come from Vite's `mode` (see pwa/build-contract.mjs — the
// one producer shared with scripts/check-pwa-build.mjs):
//   `vite build`                 → dist/    base "/"        (release tarball, local server)
//   `vite build --mode gh-pages` → dist-gh/ base "/kidpix/" (GitHub Pages)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const base = BASE_BY_MODE[mode] ?? BASE_BY_MODE.production;

  return {
    base,
    publicDir: "src/assets", // Copy src/assets to build output
    plugins: [
      // Keep the root legal files authoritative while shipping them in both
      // standalone release archives and the fully offline Pages build.
      legalFilesPlugin(),
      // Installable, fully-offline PWA (Phase 6 / WS2). The worker source is
      // pwa/sw.ts (injectManifest): Workbox injects the revisioned precache
      // list generated from the actual build output, and the worker adds the
      // Range-request handling Safari needs to play precached audio.
      VitePWA({
        strategies: "injectManifest",
        srcDir: "pwa",
        filename: "sw.ts",
        // Registration is application code so the update lifecycle has one
        // visible, tested owner instead of a generated fire-and-forget script.
        injectRegister: false,
        // The precache glob already covers every PNG; letting the plugin add
        // the manifest icons too produced duplicate entries (caught by
        // scripts/check-pwa-build.mjs), which invalidates the worker.
        includeManifestIcons: false,
        manifest: {
          // `id` resolves against the origin (not the manifest URL), so it
          // must be the base path itself — a relative "./" would collapse
          // both deployments to "/".
          id: base,
          start_url: base,
          scope: base,
          name: "Kid Pix",
          short_name: "KidPix",
          description: "A drawing playground for kids.",
          theme_color: "#000000",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "landscape",
          lang: "en",
          // All icons derive from the existing Kid Pix "guy" artwork
          // (src/assets/img/branding + apple-touch-icon.png); see docs/pwa.md.
          icons: [
            { src: "img/branding/kidpix.png", sizes: "32x32", type: "image/png" },
            { src: "apple-touch-icon.png", sizes: "180x180", type: "image/png" },
            { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        injectManifest: {
          globPatterns: [PRECACHE_GLOB],
          globIgnores: ["**/*.map"],
          maximumFileSizeToCacheInBytes: PRECACHE_MAX_FILE_BYTES,
        },
      }),
    ],
    server: {
      port: 5173,
      open: true,
    },
    build: {
      outDir: "dist",
      sourcemap: true,
      rollupOptions: {
        input: {
          main: "index.html",
        },
      },
    },
  };
});
