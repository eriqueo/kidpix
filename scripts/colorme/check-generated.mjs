#!/usr/bin/env node
// Verify that the tracked ColorMe pages are byte-for-byte reproducible.

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
    const tracked = readFileSync(join(sourceDir, name));
    const expected = readFileSync(join(temporaryDir, name));
    if (!tracked.equals(expected)) {
      throw new Error(
        `${name} is stale; run node kidpix-manual-fidelity/10-colorme-coloring-pages/generate.mjs`,
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
