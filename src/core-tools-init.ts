/**
 * Wire core tools into the legacy engine via the bridge (Phase 3).
 * Imported by kidpix-main.js AFTER the legacy tools load.
 *
 * Default behavior is UNCHANGED. Opt into the hexagonal pencil with `?core`
 * (or `?core=pencil`) — the existing Pencil button then drives the core
 * implementation, so the parity harness can prove pixel-equivalence in CI.
 */
import { bridgeTool, type KiddoPaintLike } from "../adapters/legacy-bridge";
import { createPencil } from "../core/tools/pencil";

const KP = (window as unknown as { KiddoPaint?: KiddoPaintLike & { Tools?: Record<string, unknown> } })
  .KiddoPaint;

if (KP?.Tools) {
  // Always register under a distinct id so it's available without disturbing defaults.
  KP.Tools.CorePencil = bridgeTool(createPencil(), KP);

  const params = new URLSearchParams(window.location.search);
  const which = params.get("core");
  if (params.has("core") && (which === null || which === "" || which === "pencil")) {
    // Opt-in: route the standard Pencil through the hexagon for parity testing.
    KP.Tools.Pencil = KP.Tools.CorePencil;
  }
}
