/**
 * Offline contract test against the REAL production builds.
 *
 * For each deployment target (dist/ at "/", dist-gh/ at "/kidpix/"):
 *   1. serve the built directory and load it at its deployed base;
 *   2. wait for an active service worker (install = precache complete);
 *   3. assert the precache is substantial and the legacy runtime caches are gone;
 *   4. reload so the page is controlled by the worker;
 *   5. go offline for real: close the server (any request that escapes the
 *      worker becomes a connection refusal), abort routed requests, and set
 *      the context offline;
 *   6. reload and exercise representative functionality, including
 *      late-loaded assets: a pencil stroke, the stamp tool (spritesheets),
 *      the Hidden Pictures eraser (late-loaded PNG), and audio (plain and
 *      Range requests — Safari's media stack needs the 206 path).
 *
 * The app's own asset requests are the authoritative signal here — never
 * "any request", because browsers fetch manifests/icons asynchronously.
 */
import { test, expect, type Page } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BUILD_TARGETS, PRECACHE_MIN_ENTRIES } from "../../pwa/build-contract.mjs";

const repoRoot = resolve(fileURLToPath(import.meta.url), "../../..");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".map": "application/json",
};

/** Static server for one build dir mounted at `base`; 404 for anything else. */
async function serveBuild(outDir: string, base: string) {
  const root = resolve(repoRoot, outDir);
  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith(base)) {
      res.writeHead(404).end();
      return;
    }
    let rel = decodeURIComponent(url.pathname.slice(base.length));
    if (rel === "" || rel.endsWith("/")) rel += "index.html";
    const file = normalize(join(root, rel));
    if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(readFileSync(file));
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  const { port } = server.address() as { port: number };
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((ok) => {
        server.closeAllConnections();
        server.close(() => ok());
      }),
  };
}

async function waitForApp(page: Page) {
  await page.waitForSelector("#tmpCanvas", { timeout: 20_000 });
  await page.waitForFunction(() => !!(window as any).KiddoPaint?.Current?.tool);
}

/** Non-white pixel count on the main canvas — proves a stroke landed. */
function inkPixels(page: Page) {
  return page.evaluate(() => {
    const c = document.getElementById("kiddopaint") as HTMLCanvasElement;
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] !== 0 && (d[i] < 250 || d[i + 1] < 250 || d[i + 2] < 250)) n++;
    }
    return n;
  });
}

for (const { outDir, base } of BUILD_TARGETS) {
  test.describe(`${outDir} (base ${base})`, () => {
    test("installs on one online visit, then runs fully offline", async ({ browser }) => {
      const server = await serveBuild(outDir, base);
      const context = await browser.newContext();
      const page = await context.newPage();
      const failedAppRequests: string[] = [];
      const consoleErrors: string[] = [];
      page.on("requestfailed", (r) => failedAppRequests.push(`${r.url()} (${r.failure()?.errorText})`));
      page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));

      // Surface worker install/runtime errors (e.g. a 404 during precaching)
      // instead of waiting out a timeout on `serviceWorker.ready`.
      const workerErrors: string[] = [];
      const cdp = await context.newCDPSession(page);
      await cdp.send("ServiceWorker.enable");
      cdp.on("ServiceWorker.workerErrorReported", (e) => workerErrors.push(e.errorMessage.errorMessage));

      try {
        // 1. first (online) visit
        await page.goto(server.origin + base);
        await waitForApp(page);

        // 2. an active worker means install — and therefore precaching — completed
        const activeState = await Promise.race([
          page.evaluate(() => navigator.serviceWorker.ready.then((r) => r.active?.state)),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error(`worker never became active; worker errors: ${JSON.stringify(workerErrors)}`)), 60_000),
          ),
        ]);
        expect(workerErrors, "service worker reported errors during install").toEqual([]);
        expect(["activating", "activated"]).toContain(activeState);

        // 3. the release precache is substantial; the old runtime caches are gone
        const caches = await page.evaluate(async () => {
          const names = await window.caches.keys();
          const precache = names.find((n) => n.includes("precache"));
          const keys = precache ? await (await window.caches.open(precache)).keys() : [];
          return { names, precacheEntries: keys.length };
        });
        expect(caches.precacheEntries).toBeGreaterThanOrEqual(PRECACHE_MIN_ENTRIES);
        expect(caches.names).not.toContain("kidpix-images");
        expect(caches.names).not.toContain("kidpix-audio");

        // 4. reload so the page is controlled
        await page.reload();
        await waitForApp(page);
        expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

        // 5. offline for real
        await server.close();
        await context.route("**/*", (route) => route.abort("internetdisconnected"));
        await context.setOffline(true);
        failedAppRequests.length = 0;
        consoleErrors.length = 0;

        // 6. reload and exercise
        await page.reload();
        await waitForApp(page);
        await expect(page.locator("#pencil")).toBeVisible();

        // pencil stroke lands on the canvas
        await page.click("#pencil");
        const before = await inkPixels(page);
        const canvas = page.locator("#tmpCanvas");
        await canvas.hover({ position: { x: 200, y: 200 } });
        await page.mouse.down();
        await canvas.hover({ position: { x: 320, y: 260 } });
        await page.mouse.up();
        expect(await inkPixels(page)).toBeGreaterThan(before);

        // stamp tool: spritesheets are late-loaded images
        await page.click("#stamp");
        await expect(page.locator("#genericsubmenu")).toBeVisible();
        const sheetsLoaded = await page.evaluate(async () => {
          const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("#genericsubmenu img"));
          await Promise.all(imgs.map((i) => (i.complete ? null : new Promise((r) => (i.onload = i.onerror = r)))));
          return { total: imgs.length, ok: imgs.filter((i) => i.naturalWidth > 0).length };
        });
        expect(sheetsLoaded.total).toBeGreaterThan(0);
        expect(sheetsLoaded.ok).toBe(sheetsLoaded.total);

        // Hidden Pictures eraser: picks and loads a late-loaded PNG on first use
        await page.click("#eraser");
        await page.locator('#genericsubmenu button[title="Hidden Pictures"]').click();
        const hiddenOk = await page.evaluate(async () => {
          const tool = (window as any).KiddoPaint.Tools.EraserHiddenPicture;
          const results = await Promise.all(
            (tool.hiddenPictures as string[]).map(
              (src) =>
                new Promise<boolean>((r) => {
                  const img = new Image();
                  img.onload = () => r(img.naturalWidth > 0);
                  img.onerror = () => r(false);
                  img.src = src;
                }),
            ),
          );
          return { total: results.length, ok: results.filter(Boolean).length };
        });
        expect(hiddenOk.total).toBeGreaterThan(0);
        expect(hiddenOk.ok).toBe(hiddenOk.total);

        // audio: plain fetch and a Range request (what Safari's media stack sends)
        const audio = await page.evaluate(async (b) => {
          const url = `${b}snd/pencil/pencil.mp3`;
          const full = await fetch(url);
          const part = await fetch(url, { headers: { range: "bytes=0-1" } });
          return {
            fullStatus: full.status,
            fullBytes: (await full.arrayBuffer()).byteLength,
            partStatus: part.status,
            partBytes: (await part.arrayBuffer()).byteLength,
            contentRange: part.headers.get("content-range"),
          };
        }, base);
        expect(audio.fullStatus).toBe(200);
        expect(audio.fullBytes).toBeGreaterThan(1000);
        expect(audio.partStatus).toBe(206);
        expect(audio.partBytes).toBe(2);
        expect(audio.contentRange).toMatch(/^bytes 0-1\//);

        // nothing the app asked for escaped the worker
        expect(failedAppRequests).toEqual([]);
        expect(consoleErrors).toEqual([]);
      } finally {
        await context.close();
        await server.close().catch(() => undefined);
      }
    });
  });
}
