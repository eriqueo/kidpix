/**
 * Wire core tools into the legacy engine via the bridge (Phase 3/4).
 * Imported by kidpix-main.js AFTER the legacy tools load.
 *
 * Default behavior is UNCHANGED. Opt into the hexagonal tools with `?core`
 * (all), `?core=pencil`, or `?core=line` — the matching toolbar button then
 * drives the core implementation, so the parity harness can prove
 * pixel-equivalence in CI.
 */
import { bridgeTool, type KiddoPaintLike } from "../adapters/legacy-bridge";
import { createPencil } from "../core/tools/pencil";
import { createLine } from "../core/tools/line";

const KP = (window as unknown as { KiddoPaint?: KiddoPaintLike & { Tools?: Record<string, unknown> } })
  .KiddoPaint;

if (KP?.Tools) {
  // Register core tools under distinct ids — available without disturbing defaults.
  KP.Tools.CorePencil = bridgeTool(createPencil(), KP);
  KP.Tools.CoreLine = bridgeTool(createLine(), KP);

  // Opt-in routing for parity testing; default (no param) stays legacy.
  const which = new URLSearchParams(window.location.search).get("core");
  if (which !== null) {
    if (which === "" || which === "pencil" || which === "all")
      KP.Tools.Pencil = KP.Tools.CorePencil;
    if (which === "" || which === "line" || which === "all")
      KP.Tools.Line = KP.Tools.CoreLine;
  }
}
