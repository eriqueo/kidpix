import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contractDocs = [
  "AGENTS.md",
  "ARCHITECTURE.md",
  "README.md",
  "prompts-TODO/current.txt",
];
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const scripts = new Set(Object.keys(packageJson.scripts ?? {}));
const packageManagerCommands = new Set(["install", "exec", "run", "version"]);
const failures = [];

for (const relativeDoc of contractDocs) {
  const absoluteDoc = resolve(root, relativeDoc);
  if (!existsSync(absoluteDoc)) {
    failures.push(`${relativeDoc}: contract document is missing`);
    continue;
  }

  const contents = readFileSync(absoluteDoc, "utf8");
  const commandPattern = /(?:npm(?:[ \t]+run)?|yarn)[ \t]+([\w:-]+)/g;
  for (const match of contents.matchAll(commandPattern)) {
    const command = match[1];
    if (!scripts.has(command) && !packageManagerCommands.has(command)) {
      failures.push(`${relativeDoc}: package script \`${command}\` does not exist`);
    }
  }

  const markdownLinkPattern = /\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  for (const match of contents.matchAll(markdownLinkPattern)) {
    const target = match[1];
    if (/^(?:[a-z]+:|#)/i.test(target)) continue;

    const localTarget = decodeURIComponent(target.split(/[?#]/, 1)[0]);
    const absoluteTarget = resolve(dirname(absoluteDoc), localTarget);
    if (!existsSync(absoluteTarget)) {
      failures.push(`${relativeDoc}: linked path \`${target}\` does not exist`);
    }
  }
}

if (failures.length > 0) {
  console.error("Project-document contract check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Project-document contract check passed (${contractDocs.length} documents).`);
}
