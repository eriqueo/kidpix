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
  mountDrawMeButton();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
}
