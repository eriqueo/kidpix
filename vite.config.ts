import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
// React was removed (ADR-0001); the app is the legacy engine loaded via
// src/kidpix-main.js. New work is plain TS under core/ ports/ adapters/.
export default defineConfig({
  // base: process.env.NODE_ENV === "production" ? "/kidpix/" : "/", // OLD
  // base: process.env.VITE_GITHUB_PAGES === "true" ? "/kidpix/" : "/", // OLD 2
  base: "/",
  publicDir: "src/assets", // Copy src/assets to build output
  plugins: [
    // Phase 6: installable, offline-capable PWA for the iPad. iOS uses the
    // apple-touch-icon link in index.html; the manifest covers standalone
    // display + Android. App shell is precached; the many image/sound assets
    // are cached at runtime on first use to keep the precache small.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "Kid Pix",
        short_name: "KidPix",
        description: "A drawing playground for kids.",
        theme_color: "#000000",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "landscape",
        icons: [
          { src: "apple-touch-icon.png", sizes: "180x180", type: "image/png" },
          { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "kidpix-images",
              expiration: { maxEntries: 800 },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "audio",
            handler: "CacheFirst",
            options: {
              cacheName: "kidpix-audio",
              rangeRequests: true,
              expiration: { maxEntries: 500 },
            },
          },
        ],
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
  resolve: {
    alias: {
      "@": "/src",
      "@js": "/js",
    },
  },
});
