import { generateRandomPrompt } from "./generator";

/**
 * Minimal browser UI hook for DrawMe — strictly the spec contract:
 *   button → prompt display, nothing more.
 *
 * Mounts a small "DrawMe" button into the status bar (or document body as a
 * fallback) and writes the current prompt into the status bar text. No
 * audio, no canvas integration, no tool change — this is the prompt
 * generator's UI surface, not the full DrawMe tool.
 */
export interface MountOptions {
  /** Override RNG seed source for tests; defaults to Date.now. */
  readonly seedSource?: () => number;
  /** Element to mount the button into; defaults to #statusbar. */
  readonly host?: HTMLElement | null;
  /** Element whose textContent receives the prompt; defaults to #statusbar-text. */
  readonly display?: HTMLElement | null;
}

const BUTTON_ID = "drawme-button";

export function mountDrawMeButton(options: MountOptions = {}): HTMLButtonElement | null {
  if (typeof document === "undefined") return null;
  if (document.getElementById(BUTTON_ID)) {
    return document.getElementById(BUTTON_ID) as HTMLButtonElement;
  }

  const host =
    options.host ?? document.getElementById("statusbar") ?? document.body ?? null;
  const display =
    options.display ?? document.getElementById("statusbar-text") ?? null;
  if (!host) return null;

  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.title = "DrawMe — suggest a silly thing to draw";
  button.textContent = "DrawMe";

  const seedSource = options.seedSource ?? (() => Date.now());

  button.addEventListener("click", () => {
    const prompt = generateRandomPrompt(seedSource);
    if (display) {
      display.textContent = prompt.text;
    } else {
      // Fallback so the prompt is never silently lost.
      // eslint-disable-next-line no-alert
      window.alert(prompt.text);
    }
  });

  host.appendChild(button);
  return button;
}
