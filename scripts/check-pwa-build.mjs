#!/usr/bin/env node
/**
 * Verify the PWA contract of every production build directory.
 *
 * Runs as the last step of `yarn build` (and in CI). For each target in
 * pwa/build-contract.mjs it asserts:
 *   - the web manifest carries the required fields, id/start_url/scope equal
 *     the target's base, and every referenced icon exists with the declared
 *     pixel size (PNG) — including the required favicon / Apple / 192 / 512 /
 *     maskable set;
 *   - index.html loads the application entry, which manually registers the
 *     worker at the target's base without HTTP-cache reuse;
 *   - the worker's revisioned precache has no duplicate URLs, is substantial,
 *     names only files that exist, and covers every deployed file except the
 *     documented exemptions (the worker itself and source maps);
 *   - no precached file exceeds the configured size cap;
 *   - the worker calls skipWaiting so a complete update cannot remain stranded.
 *
 * Zero dependencies so it runs under bare `node` in any workflow.
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BUILD_TARGETS,
  PRECACHE_EXEMPT,
  PRECACHE_MAX_FILE_BYTES,
  PRECACHE_MIN_ENTRIES,
  REQUIRED_ICONS,
} from "../pwa/build-contract.mjs";

const repoRoot = resolve(fileURLToPath(import.meta.url), "../..");

/** Recursively list files under dir as POSIX paths relative to dir. */
function listFiles(root, dir = root) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(root, full));
    else out.push(relative(root, full).split("\\").join("/"));
  }
  return out.sort();
}

/** Width×height from a PNG's IHDR chunk. */
function pngSize(buf) {
  const isPng = buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47;
  if (!isPng) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

/**
 * Pull the injected precache manifest out of the built worker. Workbox emits
 * entries as {"revision":"…"|null,"url":"…"} objects; the bundler preserves the
 * JSON key order, but the regex accepts either order to be safe.
 */
function precacheUrls(swSource) {
  const entry =
    /\{(?:"revision":(?:null|"[^"]*"),)?"url":"([^"]+)"(?:,"revision":(?:null|"[^"]*"))?\}/g;
  const urls = [];
  for (const m of swSource.matchAll(entry)) urls.push(m[1]);
  return urls;
}

function checkTarget({ outDir, base }) {
  const errors = [];
  const fail = (msg) => errors.push(msg);
  const dir = resolve(repoRoot, outDir);
  if (!existsSync(dir)) return [`${outDir}: directory missing (run the build first)`];

  const read = (f) => readFileSync(join(dir, f), "utf8");
  const files = listFiles(dir);

  // --- manifest -----------------------------------------------------------
  let manifest;
  try {
    manifest = JSON.parse(read("manifest.webmanifest"));
  } catch (e) {
    return [`${outDir}: manifest.webmanifest missing or unparsable (${e.message})`];
  }
  for (const field of ["name", "short_name", "theme_color", "background_color"]) {
    if (typeof manifest[field] !== "string" || !manifest[field]) fail(`manifest.${field} missing`);
  }
  for (const field of ["id", "start_url", "scope"]) {
    if (manifest[field] !== base) fail(`manifest.${field} = ${JSON.stringify(manifest[field])}, expected ${JSON.stringify(base)}`);
  }
  if (manifest.display !== "standalone") fail(`manifest.display = ${manifest.display}, expected standalone`);

  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  if (icons.length === 0) fail("manifest.icons missing");
  for (const icon of icons) {
    const path = join(dir, icon.src);
    if (!existsSync(path)) {
      fail(`icon ${icon.src} referenced by the manifest does not exist`);
      continue;
    }
    const size = pngSize(readFileSync(path));
    if (size && `${size.w}x${size.h}` !== icon.sizes) {
      fail(`icon ${icon.src} is ${size.w}x${size.h} but the manifest says ${icon.sizes}`);
    }
  }
  for (const req of REQUIRED_ICONS) {
    const purpose = req.purpose ?? "any";
    const found = icons.some(
      (i) => i.sizes === req.sizes && (i.purpose ?? "any").split(/\s+/).includes(purpose),
    );
    if (!found) fail(`manifest lacks a ${req.sizes} icon with purpose "${purpose}"`);
  }

  // --- index.html + registration ------------------------------------------
  const html = read("index.html");
  if (!html.includes(`href="${base}manifest.webmanifest"`)) fail(`index.html does not link ${base}manifest.webmanifest`);
  if (!/rel="apple-touch-icon"/.test(html)) fail("index.html lacks the apple-touch-icon link");
  if (files.includes("registerSW.js")) fail("generated registerSW.js exists alongside the application-owned registration path");
  const entryMatch = html.match(/<script[^>]+src="([^"]*assets\/main-[^"]+\.js)"/);
  if (!entryMatch) {
    fail("index.html does not load a built main entry");
  } else {
    const entryPath = entryMatch[1].startsWith(base) ? entryMatch[1].slice(base.length) : entryMatch[1];
    const entry = read(entryPath);
    if (!entry.includes("PWA_REGISTRATION_FAILED") || !/\.register\([^)]*\{scope:/.test(entry)) {
      fail("application entry does not contain the owned service-worker registration path");
    }
    if (!entry.includes('updateViaCache:"none"')) fail("application registration does not bypass HTTP cache for worker updates");
  }

  // --- precache -----------------------------------------------------------
  const sw = read("sw.js");
  if (!/skipWaiting\(/.test(sw)) fail("sw.js does not call skipWaiting() — an update can remain stranded behind an open client");
  const urls = precacheUrls(sw);
  if (urls.length < PRECACHE_MIN_ENTRIES) fail(`precache has ${urls.length} entries, expected at least ${PRECACHE_MIN_ENTRIES}`);
  const seen = new Set();
  for (const u of urls) {
    if (seen.has(u)) fail(`precache lists ${u} more than once (duplicate revisions invalidate the worker)`);
    seen.add(u);
  }
  const deployed = new Set(files);
  for (const u of seen) if (!deployed.has(u)) fail(`precache names ${u}, which is not in ${outDir}`);
  const exempt = (f) => PRECACHE_EXEMPT.some((re) => re.test(f));
  for (const f of files) {
    if (exempt(f)) continue;
    if (!seen.has(f)) fail(`deployed file ${f} is not in the precache (extend PRECACHE_GLOB or PRECACHE_EXEMPT)`);
    const bytes = statSync(join(dir, f)).size;
    if (bytes > PRECACHE_MAX_FILE_BYTES) fail(`${f} is ${bytes} bytes, over the ${PRECACHE_MAX_FILE_BYTES}-byte precache cap`);
  }

  if (errors.length === 0) {
    console.log(`✓ ${outDir} (base ${base}): ${urls.length} precache entries cover ${files.filter((f) => !exempt(f)).length} deployed files; ${icons.length} icons OK`);
  }
  return errors.map((e) => `${outDir}: ${e}`);
}

const problems = BUILD_TARGETS.flatMap(checkTarget);
if (problems.length) {
  console.error(`✗ PWA build check failed:\n  - ${problems.join("\n  - ")}`);
  process.exit(1);
}
