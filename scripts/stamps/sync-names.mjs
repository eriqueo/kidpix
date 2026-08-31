#!/usr/bin/env node
// Generate js/stamps/stamp-names-data.js from util/stamp-names.json.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = resolve(repoRoot, "util/stamp-names.json");
const target = resolve(repoRoot, "js/stamps/stamp-names-data.js");
const args = process.argv.slice(2);
const check = args[0] === "--check";

if (args.length > (check ? 1 : 0)) {
  console.error("Usage: sync-names.mjs [--check]");
  process.exit(2);
}

const stampNames = JSON.parse(readFileSync(source, "utf8"));
const generated =
  "// Stamp names data - generated from util/stamp-names.json\n" +
  "// This file contains human-readable names for all stamps in the sprite sheets\n\n" +
  "KiddoPaint.Stamps = KiddoPaint.Stamps || {};\n" +
  "KiddoPaint.Stamps.namesData = \n" +
  `${JSON.stringify(stampNames, null, 2)};\n`;

if (check) {
  let current;
  try {
    current = readFileSync(target, "utf8");
  } catch (error) {
    console.error(`sync-names.mjs: cannot read generated target: ${error.message}`);
    process.exit(1);
  }
  if (current !== generated) {
    console.error(
      "sync-names.mjs: generated stamp names are stale; run node scripts/stamps/sync-names.mjs",
    );
    process.exit(1);
  }
  console.error(
    `sync-names.mjs: ${stampNames.length} stamp sheets are current`,
  );
} else {
  // Idempotent by construction: the target is a complete projection of the source JSON.
  writeFileSync(target, generated);
  console.error(
    `sync-names.mjs: wrote ${stampNames.length} stamp sheets to ${target}`,
  );
}
