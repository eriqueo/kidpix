/**
 * Bridge: wire the data-driven registries into the legacy KiddoPaint engine
 * after it has loaded. Imported by src/kidpix-main.js AFTER js/sounds/sounds.js,
 * so `KiddoPaint.Sounds.Library` already exists. Purely additive.
 */
import { registerSounds } from "../core/sound/sound-registry";
import { customSounds } from "../core/sound/custom-sounds";

interface KiddoPaintGlobal {
  Sounds?: { Library?: Record<string, unknown> };
}

const KP = (window as unknown as { KiddoPaint?: KiddoPaintGlobal }).KiddoPaint;

if (KP?.Sounds?.Library) {
  registerSounds(
    KP.Sounds.Library as Record<string, never>,
    customSounds,
    (url) => new Audio(url),
  );
}
