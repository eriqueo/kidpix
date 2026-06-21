/**
 * Bridge: expose the core ColorMe flood-fill primitive on the legacy
 * KiddoPaint namespace so js/tools/colorme.js can call it without import.
 * Loaded after the legacy engine so KiddoPaint already exists.
 */
import { floodFill, type FillColor } from "../core/colorme/flood-fill";
import page01 from "../kidpix-manual-fidelity/10-colorme-coloring-pages/01-cozy-house.png";
import page02 from "../kidpix-manual-fidelity/10-colorme-coloring-pages/02-friendly-fish.png";
import page03 from "../kidpix-manual-fidelity/10-colorme-coloring-pages/03-happy-robot.png";
import page04 from "../kidpix-manual-fidelity/10-colorme-coloring-pages/04-three-flowers.png";
import page05 from "../kidpix-manual-fidelity/10-colorme-coloring-pages/05-sunny-car.png";
import page06 from "../kidpix-manual-fidelity/10-colorme-coloring-pages/06-big-butterfly.png";
import page07 from "../kidpix-manual-fidelity/10-colorme-coloring-pages/07-little-sailboat.png";
import page08 from "../kidpix-manual-fidelity/10-colorme-coloring-pages/08-dino-stomp.png";
import page09 from "../kidpix-manual-fidelity/10-colorme-coloring-pages/09-balloon-bunch.png";
import page10 from "../kidpix-manual-fidelity/10-colorme-coloring-pages/10-curly-cat.png";

interface PageMeta {
  file: string;
  title: string;
  url: string;
  // True for user-uploaded pages (persisted in localStorage); absent for the
  // bundled set so we never re-serialize the built-in pages.
  custom?: boolean;
}

interface ColorMeNS {
  pages: PageMeta[];
  floodFill: typeof floodFill;
  // Append a user-uploaded page, persist it, and return it.
  addCustomPage: (meta: PageMeta) => PageMeta;
  // mutable runtime state set by the tool
  active: boolean;
  currentPage: PageMeta | null;
}

// localStorage key holding the array of user-uploaded coloring pages.
const CUSTOM_KEY = "kiddopaint_colorme_custom";

// Read persisted custom pages, tolerating absent/corrupt storage.
function loadCustomPages(): PageMeta[] {
  try {
    const raw =
      typeof localStorage !== "undefined" ? localStorage.getItem(CUSTOM_KEY) : null;
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (p): p is { file?: unknown; title: unknown; url: unknown } =>
          !!p &&
          typeof (p as { title?: unknown }).title === "string" &&
          typeof (p as { url?: unknown }).url === "string",
      )
      .map((p) => ({
        file:
          typeof p.file === "string" ? p.file : String(p.title),
        title: String(p.title),
        url: String(p.url),
        custom: true,
      }));
  } catch {
    return [];
  }
}

// The 10 pages (file, title, url) — mirrors pages.json (the on-disk manifest).
// Inlined here so this module needs no JSON import; the smoke test below cross-checks both.
const pages: PageMeta[] = [
  { file: "01-cozy-house.png", title: "Cozy House", url: page01 },
  { file: "02-friendly-fish.png", title: "Friendly Fish", url: page02 },
  { file: "03-happy-robot.png", title: "Happy Robot", url: page03 },
  { file: "04-three-flowers.png", title: "Three Flowers", url: page04 },
  { file: "05-sunny-car.png", title: "Sunny Car", url: page05 },
  { file: "06-big-butterfly.png", title: "Big Butterfly", url: page06 },
  { file: "07-little-sailboat.png", title: "Little Sailboat", url: page07 },
  { file: "08-dino-stomp.png", title: "Dino Stomp", url: page08 },
  { file: "09-balloon-bunch.png", title: "Balloon Bunch", url: page09 },
  { file: "10-curly-cat.png", title: "Curly Cat", url: page10 },
];

// Persist every custom page currently in the list. Swallows quota/availability
// errors: the page still lives in memory for the session, just not across reloads.
function persistCustomPages(): void {
  try {
    if (typeof localStorage === "undefined") return;
    const customs = ns.pages
      .filter((p) => p.custom)
      .map((p) => ({ file: p.file, title: p.title, url: p.url }));
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customs));
  } catch {
    // Storage full or unavailable — keep going with the in-memory page.
  }
}

const ns: ColorMeNS = {
  pages,
  floodFill,
  addCustomPage(meta: PageMeta): PageMeta {
    const stored: PageMeta = { ...meta, custom: true };
    ns.pages.push(stored);
    persistCustomPages();
    return stored;
  },
  active: false,
  currentPage: null,
};

// Merge any previously-uploaded pages so they survive reloads.
for (const cp of loadCustomPages()) {
  ns.pages.push(cp);
}

interface KPWithColorMe {
  ColorMe?: ColorMeNS;
}

const KP = (window as unknown as { KiddoPaint?: KPWithColorMe }).KiddoPaint;
if (KP) {
  KP.ColorMe = ns;
}

// Re-export for tests.
export { ns as colorMe, pages };
export type { PageMeta, FillColor };
