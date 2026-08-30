# Offline PWA

Kid Pix installs to a home screen and runs with no network after **one completed
online visit**. This page is the one description of how that works, how to verify it,
and what it cannot do.

## Contract

1. After one completed online visit, the deployed app reopens and works with every
   ordinary network request blocked.
2. Both production artifacts are covered: `dist/` (base `/`, release tarball / local
   server) and `dist-gh/` (base `/kidpix/`, GitHub Pages).
3. Every deploy-owned runtime file is precached — HTML, JS, CSS, images, spritesheets,
   audio, JSON, manifest. Nothing is "cached on first use".
4. User data (the current drawing, ColorMe pages, custom Hidden Pictures, sound recordings,
   and settings) stays in `localStorage` / IndexedDB. The worker only ever caches files
   that ship in the build; it never touches CacheStorage with user media. Hidden Pictures
   stores only its processed PNG, keeps at most 20 custom entries, and evicts the oldest
   custom entry when that queue is full.
5. An update never reloads a live session. A new worker installs in the background
   and activates only after **every tab of the app is closed**.

## How it is built

| Piece | Where | Role |
|---|---|---|
| Build contract | `pwa/build-contract.mjs` | One producer for the facts shared by the build and the checker: mode → base, precache glob, size cap, exemptions, required icons. |
| Vite config | `vite.config.ts` | `vite build` → `dist/`; `vite build --mode gh-pages` → `dist-gh/`. Configures vite-plugin-pwa (injectManifest) and the web manifest (`id`/`start_url`/`scope` = base). |
| Worker source | `pwa/sw.ts` | Workbox precache from the injected, revisioned manifest; Range-aware route so Safari can play cached audio (`206`); navigation fallback to `index.html`; no `skipWaiting`; deletes the pre-2026-08-29 runtime caches. Typechecked by `tsconfig.sw.json`. |
| Registration | generated `registerSW.js` | Emitted by the plugin at the build's base and scope. |
| Icons | `src/assets/` | `pwa-192.png`, `pwa-512.png`, `pwa-maskable-512.png`, `apple-touch-icon.png`, `favicon.ico` — all derived from the Kid Pix "guy" art in `src/assets/img/branding/`. Checked in; no image tooling in the build. |
| Build checker | `scripts/check-pwa-build.mjs` | Last step of `yarn build` (also `yarn check:pwa`). |
| Offline test | `tests/pwa/offline.spec.ts` | `yarn test:pwa` against the built artifacts. |

`manifest.webmanifest` is added to the precache by the plugin; the glob must **not** list
`*.webmanifest` (duplicate entries invalidate the worker — the checker catches this).

### Why injectManifest rather than generateSW

Media elements — Safari above all — request audio with a `Range:` header and reject a
plain `200`. `workbox-precaching` cannot answer a Range request, and in a generated
worker the precache route is always registered first. `pwa/sw.ts` registers a
`workbox-range-requests` route *before* `precacheAndRoute`, slicing the cached body
into a `206`. The offline test asserts this path.

### Precache size

400 entries, ≈3.6 MiB (2026-08-29). The largest runtime file is `assets/main-*.js`
(413 KB); `PRECACHE_MAX_FILE_BYTES` is 1 MiB. If a file ever exceeds the cap Workbox
drops it and the checker fails the build, so the cap gets raised on purpose.

Source maps (`*.map`) are deployed but not precached: DevTools fetches them, the app
never does. They are the only exemption besides `sw.js` itself.

## Verification

```bash
yarn build       # both artifacts, then scripts/check-pwa-build.mjs
yarn test:pwa    # Playwright, chromium, against dist/ and dist-gh/
```

The checker asserts, per output directory: manifest fields, `id`/`start_url`/`scope`
equal the base, every referenced icon exists with the declared pixel size, the required
icon set (32 favicon / 180 Apple / 192 / 512 any / 512 maskable), `index.html` and
`registerSW.js` point at the base, no duplicate precache URLs, precache ⊇ every deployed
file minus exemptions, size cap, and no `skipWaiting`.

The offline test, per output directory: serves the build, waits for the worker to become
active (install = precache complete), checks the precache is substantial and the legacy
runtime caches are gone, reloads so the page is controlled, **closes the server**, aborts
every routed request and sets the context offline, reloads, then draws with the pencil,
opens the stamp tool (spritesheets), the Hidden Pictures eraser (late-loaded PNGs), and
fetches audio both plainly and with a `Range` header.

On NixOS Playwright's bundled Chromium cannot launch; use the system binary:

```bash
KIDPIX_CHROMIUM=$(command -v chromium) yarn test:pwa
KIDPIX_CHROMIUM=$(command -v chromium) yarn test:e2e --project=chromium
```

## Installing

The **first visit needs a network connection and HTTPS** (or `localhost`) — service
workers do not run on plain `http://` LAN addresses or on `file://`. Load
<https://eriqueo.github.io/kidpix/> once, wait for it to finish loading, then install.

**iPad / iPhone (Safari)**
1. Open the URL in Safari (not in an in-app browser).
2. Tap the Share button, then **Add to Home Screen**, then **Add**.
3. Launch from the home-screen icon. It opens full-screen in landscape and works in
   Airplane Mode.

**Android / Samsung**
- *Chrome:* open the URL, tap the ⋮ menu, then **Install app** (or **Add to Home
  screen**), then **Install**.
- *Samsung Internet:* open the URL, tap the ≡ menu, then **Add page to**, then **Home
  screen** (or tap the install icon in the address bar).

**Desktop (Chrome / Edge):** click the install icon at the right end of the address bar.

## Updating

When a new version is deployed, the next online launch downloads it in the background.
It becomes active the next time the app is opened after **all its windows/tabs were
closed**. Nothing reloads while a drawing is open. On iOS, fully close the app from the
app switcher.

## Limitations

- **Storage eviction.** Browsers may purge site data under storage pressure. Safari
  deletes data for sites not used in 7 days when they run in the browser tab; a
  home-screen-installed app is exempt from that rule but not from low-disk purges.
  Recovery is a single online visit — the worker re-precaches everything.
- **First visit must be online.** There is no way to seed the cache from a file.
- **Release tarball** (`dist/`): the worker registers when served from `localhost`
  (e.g. `python -m http.server`); over a plain-`http://` LAN address it does not, and
  the page simply runs online.
- **`file://`** does not work (module scripts and workers are both blocked).
- **Large deploys** grow the precache; ~4 MiB today is trivial, but the checker's size
  cap exists so growth is a decision, not a surprise.
