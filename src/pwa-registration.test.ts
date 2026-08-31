import { describe, expect, it, vi } from "vitest";
import { wirePwaUpdateFlow } from "./pwa-registration";

function fixture(controlledAtStart: boolean) {
  const listeners = new Map<string, EventListener>();
  const registration = {} as ServiceWorkerRegistration;
  const register = vi.fn(async () => registration);
  const serviceWorker = {
    controller: controlledAtStart ? ({} as ServiceWorker) : null,
    addEventListener: vi.fn((name: string, listener: EventListener) => {
      listeners.set(name, listener);
    }),
    register,
  } as unknown as Pick<ServiceWorkerContainer, "controller" | "addEventListener" | "register">;
  const button = document.createElement("button");
  button.hidden = true;
  const flushDrawing = vi.fn();
  const reload = vi.fn();
  const runRegistration = wirePwaUpdateFlow({
    serviceWorker,
    button,
    workerUrl: "/kidpix/sw.js",
    scope: "/kidpix/",
    flushDrawing,
    reload,
  });

  return { button, flushDrawing, listeners, register, reload, runRegistration };
}

describe("PWA update flow", () => {
  it("shows a save-first reload action when a controlled page gets a replacement", () => {
    const { button, flushDrawing, listeners, reload } = fixture(true);

    listeners.get("controllerchange")?.(new Event("controllerchange"));
    expect(button.hidden).toBe(false);

    button.click();
    expect(button.disabled).toBe(true);
    expect(flushDrawing).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
    expect(flushDrawing.mock.invocationCallOrder[0]).toBeLessThan(reload.mock.invocationCallOrder[0]);
  });

  it("does not announce the controller claimed during a first install", () => {
    const { button, listeners } = fixture(false);

    listeners.get("controllerchange")?.(new Event("controllerchange"));

    expect(button.hidden).toBe(true);
  });

  it("registers the base-scoped worker without HTTP-cache reuse", async () => {
    const { register, runRegistration } = fixture(false);

    await runRegistration();

    expect(register).toHaveBeenCalledWith("/kidpix/sw.js", {
      scope: "/kidpix/",
      updateViaCache: "none",
    });
  });
});
