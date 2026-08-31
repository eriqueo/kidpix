#!/usr/bin/env node
// Verify that the tracked ColorMe pages reproduce the same pixels and manifest.

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceDir = join(
  repoRoot,
  "kidpix-manual-fidelity/10-colorme-coloring-pages",
);
const generator = join(sourceDir, "generate.mjs");
const temporaryDir = mkdtempSync(join(tmpdir(), "kidpix-colorme-check-"));
const temporaryGenerator = join(temporaryDir, basename(generator));

function generatedFiles(directory) {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".png") || name === "pages.json")
    .sort();
}

function decodedPng(path) {
  const png = readFileSync(path);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!png.subarray(0, signature.length).equals(signature)) {
    throw new Error(`${basename(path)} is not a PNG`);
  }

  let offset = signature.length;
  let ihdr = null;
  const idat = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > png.length) {
      throw new Error(`${basename(path)} has a truncated ${type} chunk`);
    }
    if (type === "IHDR") ihdr = png.subarray(dataStart, dataEnd);
    if (type === "IDAT") idat.push(png.subarray(dataStart, dataEnd));
    offset = dataEnd + 4;
    if (type === "IEND") break;
  }

  if (!ihdr || idat.length === 0) {
    throw new Error(`${basename(path)} is missing required PNG chunks`);
  }
  return { ihdr, scanlines: inflateSync(Buffer.concat(idat)) };
}

try {
  copyFileSync(generator, temporaryGenerator);
  execFileSync(process.execPath, [temporaryGenerator], { stdio: "pipe" });

  const expectedFiles = generatedFiles(temporaryDir);
  const trackedFiles = generatedFiles(sourceDir);
  if (JSON.stringify(trackedFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(
      `generated file set is stale\ntracked: ${trackedFiles.join(", ")}\nexpected: ${expectedFiles.join(", ")}`,
    );
  }

  for (const name of expectedFiles) {
    const trackedPath = join(sourceDir, name);
    const expectedPath = join(temporaryDir, name);
    if (name === "pages.json") {
      if (readFileSync(trackedPath, "utf8") === readFileSync(expectedPath, "utf8")) {
        continue;
      }
      throw new Error(
        `${name} is stale; run node kidpix-manual-fidelity/10-colorme-coloring-pages/generate.mjs`,
      );
    }

    const tracked = decodedPng(trackedPath);
    const expected = decodedPng(expectedPath);
    if (!tracked.ihdr.equals(expected.ihdr) || !tracked.scanlines.equals(expected.scanlines)) {
      throw new Error(
        `${name} has stale pixels; run node kidpix-manual-fidelity/10-colorme-coloring-pages/generate.mjs`,
      );
    }
  }

  console.error(
    `check-generated.mjs: ${expectedFiles.length - 1} ColorMe pages and manifest are current`,
  );
} catch (error) {
  console.error(`check-generated.mjs: ${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(temporaryDir, { recursive: true, force: true });
}
