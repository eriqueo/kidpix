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
}

interface ColorMeNS {
  pages: PageMeta[];
  floodFill: typeof floodFill;
  // mutable runtime state set by the tool
  active: boolean;
  currentPage: PageMeta | null;
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

const ns: ColorMeNS = {
  pages,
  floodFill,
  active: false,
  currentPage: null,
};

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
