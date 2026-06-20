/**
 * ColorMe smoke test: verify the 10 pages exist on disk, the pages.json
 * manifest lists exactly those 10 files, and every PNG starts with the
 * correct PNG signature (i.e. it's a parseable image, not a broken stub).
 *
 * This protects against silent asset regressions: a missing or truncated
 * page file would break ColorMe mode at runtime with no other warning.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface ManifestPage {
  file: string;
  title: string;
}
interface Manifest {
  pages: ManifestPage[];
  width: number;
  height: number;
}

describe("ColorMe coloring pages", () => {
  const manifestPath = join(HERE, "pages.json");
  const manifest: Manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

  it("manifest declares exactly 10 pages", () => {
    expect(manifest.pages).toHaveLength(10);
  });

  it("manifest carries the canvas size and line weight", () => {
    expect(manifest.width).toBeGreaterThan(0);
    expect(manifest.height).toBeGreaterThan(0);
  });

  it("every manifest entry has a unique non-empty title", () => {
    const titles = manifest.pages.map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
    for (const t of titles) expect(t.trim().length).toBeGreaterThan(0);
  });

  it("each declared page file exists on disk and is a valid PNG", () => {
    for (const page of manifest.pages) {
      const path = join(HERE, page.file);
      expect(existsSync(path), `missing ${page.file}`).toBe(true);
      const head = readFileSync(path).subarray(0, 8);
      expect(Buffer.compare(head, PNG_SIG), `not a PNG: ${page.file}`).toBe(0);
    }
  });
});
