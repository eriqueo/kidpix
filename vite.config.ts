import { defineConfig } from "vite";

// https://vite.dev/config/
// React was removed (ADR-0001); the app is the legacy engine loaded via
// src/kidpix-main.js. New work is plain TS under core/ ports/ adapters/.
export default defineConfig({
  // base: process.env.NODE_ENV === "production" ? "/kidpix/" : "/", // OLD
  // base: process.env.VITE_GITHUB_PAGES === "true" ? "/kidpix/" : "/", // OLD 2
  base: "/",
  publicDir: "src/assets", // Copy src/assets to build output
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
