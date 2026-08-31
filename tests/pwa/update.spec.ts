/**
 * Production-wiring update test.
 *
 * A minimal previous Kid Pix release first owns the scope and serves its old
 * app shell. The server then switches to the real current build. This catches
 * the lifecycle failure that first-install/offline tests cannot: a replacement
 * worker must activate while the old page remains open, without reloading it.
 */
import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BUILD_TARGETS } from "../../pwa/build-contract.mjs";

const repoRoot = resolve(fileURLToPath(import.meta.url), "../../..");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
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

function oldShell(base: string): string {
  return `<!doctype html>
    <html><body>
      <main id="legacy-slideshow">SlideShow</main>
      <script>
        navigator.serviceWorker.register(${JSON.stringify(`${base}sw.js`)}, {
          scope: ${JSON.stringify(base)}
        });
      </script>
    </body></html>`;
}

function oldWorker(base: string): string {
  const shell = oldShell(base);
  return `
    const CACHE = "kidpix-update-test-old-shell";
    const BASE = ${JSON.stringify(base)};
    const SHELL = ${JSON.stringify(shell)};
    self.addEventListener("install", (event) => {
      event.waitUntil(caches.open(CACHE).then((cache) =>
        cache.put(BASE, new Response(SHELL, {
          headers: { "content-type": "text/html; charset=utf-8" }
        }))
      ));
    });
    self.addEventListener("activate", (event) => {
      event.waitUntil(self.clients.claim());
    });
    self.addEventListener("fetch", (event) => {
      if (event.request.mode === "navigate") {
        event.respondWith(caches.open(CACHE).then((cache) => cache.match(BASE)));
      }
    });
  `;
}

async function serveSwitchableBuild(outDir: string, base: string) {
  const root = resolve(repoRoot, outDir);
  let current = false;
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith(base)) {
      res.writeHead(404).end();
      return;
    }

    if (!current) {
      if (url.pathname === base) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        res.end(oldShell(base));
        return;
      }
      if (url.pathname === `${base}sw.js`) {
        res.writeHead(200, { "content-type": "text/javascript", "cache-control": "no-store" });
        res.end(oldWorker(base));
        return;
      }
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

  await new Promise<void>((resolveListening) => server.listen(0, "127.0.0.1", resolveListening));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("test server did not expose a port");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    useCurrentBuild: () => {
      current = true;
    },
    close: () => new Promise<void>((resolveClose) => server.close(() => resolveClose())),
  };
}

for (const { outDir, base } of BUILD_TARGETS) {
  test(`${outDir} activates an update without reloading the live page`, async ({ browser }) => {
    const server = await serveSwitchableBuild(outDir, base);
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(server.origin + base);
      await expect(page.locator("#legacy-slideshow")).toBeVisible();
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();
      await expect(page.locator("#legacy-slideshow")).toBeVisible();
      expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

      server.useCurrentBuild();
      const update = await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.ready;
        let controllerChanged = false;
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => {
            controllerChanged = true;
          },
          { once: true },
        );
        await registration.update();
        await new Promise((resolveWait) => setTimeout(resolveWait, 5_000));
        return {
          controllerChanged,
          waiting: registration.waiting?.state ?? null,
          activeScript: registration.active?.scriptURL ?? null,
        };
      });

      expect(update, "replacement worker must activate while the old client remains open").toMatchObject({
        controllerChanged: true,
        waiting: null,
      });
      await expect(page.locator("#legacy-slideshow"), "activation must not force-reload a drawing").toBeVisible();

      await page.reload();
      await page.waitForSelector("#tmpCanvas", { timeout: 20_000 });
      await expect(page.locator("#legacy-slideshow")).toHaveCount(0);
      await expect(page.locator("#export-png-btn")).toBeVisible();
    } finally {
      await context.close();
      await server.close();
    }
  });
}
