import { describe, expect, it, beforeEach } from "vitest";
import { mountDrawMeButton } from "./ui-hook";

describe("DrawMe UI hook", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="statusbar"><span id="statusbar-text">hover...</span></div>
    `;
  });

  it("mounts a single DrawMe button into the status bar", () => {
    const btn = mountDrawMeButton();
    expect(btn).not.toBeNull();
    expect(document.querySelectorAll("#drawme-button").length).toBe(1);
    // idempotent: a second mount does not duplicate the button
    mountDrawMeButton();
    expect(document.querySelectorAll("#drawme-button").length).toBe(1);
  });

  it("on click writes a deterministic prompt to the display element", () => {
    const display = document.getElementById("statusbar-text")!;
    const btn = mountDrawMeButton({ seedSource: () => 12345 })!;
    btn.click();
    expect(display.textContent).toMatch(/^Draw an? .+\.$/);
    const first = display.textContent;
    btn.click();
    expect(display.textContent).toBe(first); // same seed source → same prompt
  });
});
