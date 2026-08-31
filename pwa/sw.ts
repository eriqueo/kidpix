/// <reference lib="webworker" />
/**
 * Kid Pix service worker (source). Built by vite-plugin-pwa in injectManifest
 * mode: Workbox replaces `self.__WB_MANIFEST` with the revisioned list of
 * every file in the production output (see pwa/build-contract.mjs), so there
 * is no hand-maintained asset list anywhere.
 *
 * Lives outside src/ on purpose — it is deployment plumbing, not application
 * code, and the app's architecture checks do not apply to it.
 *
 * Update policy (contract §9): a replacement activates as soon as its complete
 * precache is installed. Activation and claiming do NOT navigate or reload a
 * client; the current drawing page stays put until the child chooses the
 * app's Update Ready action, which flushes persistence before reloading.
 *
 * User data (the current drawing, ColorMe pages, custom Hidden Pictures, sound
 * recordings, and settings) lives in localStorage / IndexedDB and is never
 * fetched over the network, so nothing here can copy it into CacheStorage.
 */
import { clientsClaim } from "workbox-core";
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  matchPrecache,
  precacheAndRoute,
} from "workbox-precaching";
import { createPartialResponse } from "workbox-range-requests";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope;

// Do not strand a complete replacement in "waiting" behind a long-lived iPad
// Safari tab. This only advances the worker lifecycle; it does not reload or
// navigate any client.
self.skipWaiting();

// Runtime caches created by the pre-2026-08-29 worker (app-shell precache +
// CacheFirst image/audio routes). Everything is precached now, so they are
// dead weight; delete them once on activation. Permanent by design: a device
// may first see this worker years after that one.
const LEGACY_RUNTIME_CACHES = ["kidpix-images", "kidpix-audio"];

// Media elements (Safari especially) fetch audio with `Range:` headers and
// refuse a plain 200 answer. The precache route below cannot answer with a
// 206, so this route runs first and slices the precached body itself.
// Registered BEFORE precacheAndRoute so it wins the router's first-match.
registerRoute(
  ({ request }) => request.headers.has("range"),
  async ({ request }) => {
    const full = await matchPrecache(request.url);
    if (!full) return fetch(request);
    return createPartialResponse(request, full);
  },
);

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// App-shell navigation: any in-scope navigation is answered with the
// precached index.html (relative URL → resolved against this worker's
// location, so it is correct for both "/" and "/kidpix/").
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

// Control already-open pages as soon as this worker activates. The page-level
// controllerchange listener then offers an explicit, save-first reload.
clientsClaim();

self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all(LEGACY_RUNTIME_CACHES.map((name) => caches.delete(name))));
});
