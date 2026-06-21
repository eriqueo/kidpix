/**
 * Bridge: mount the DrawMe prompt-generator button into the legacy status bar.
 * Loaded last from src/kidpix-main.js so #statusbar already exists in the DOM.
 *
 * Strictly the spec's contract: a button that, on click, writes a randomly
 * generated DrawMe-style prompt into #statusbar-text. No tool change, no
 * canvas integration.
 */
import { mountDrawMeButton } from "../kidpix-manual-fidelity/03-drawme-prompt-generator/ui-hook";

function mount(): void {
  // Prefer the right-aligned status-bar action group so DrawMe lines up with
  // Print/Project/Frame instead of floating in the centered description slot.
  const actions = document.getElementById("statusbar-actions");
  const button = mountDrawMeButton(actions ? { host: actions } : {});
  // Put DrawMe first in the group (it's a kid-facing action, not a setting).
  if (button && actions && actions.firstChild) {
    actions.insertBefore(button, actions.firstChild);
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
}
