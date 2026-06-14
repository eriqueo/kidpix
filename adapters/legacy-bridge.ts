import type { Tool, ToolContext, StrokeStyle } from "../core/ports";
import { Canvas2DRenderer } from "./canvas2d-renderer";

/**
 * The strangler-fig bridge (Phase 3): adapt a core `Tool` into the legacy
 * tool shape ({mousedown,mousemove,mouseup}(ev)) so it runs inside the EXISTING
 * KiddoPaint event loop — one running app, no second app to maintain (Premortem #3).
 *
 * The legacy global `KiddoPaint` thus becomes one adapter behind the ports; new
 * core tools never touch it directly.
 */

interface LegacyEvent {
  _x: number;
  _y: number;
}

/** Minimal slice of the legacy global the bridge reads/writes. */
export interface KiddoPaintLike {
  Current: { color: string; altColor?: string; scaling: number; multiplier?: number };
  Display: { context: CanvasRenderingContext2D; saveMain(): void };
  Sounds: { Library: { playRand(id: string): void }; [k: string]: unknown };
  Textures: { Solid(color: string): StrokeStyle };
}

export interface LegacyTool {
  mousedown(ev: LegacyEvent): void;
  mousemove(ev: LegacyEvent): void;
  mouseup(ev: LegacyEvent): void;
}

/** Build a fresh ToolContext from the LIVE globals on every event. */
function contextFrom(KP: KiddoPaintLike): ToolContext {
  return {
    renderer: new Canvas2DRenderer(KP.Display.context),
    sound: {
      play(id: string) {
        const named = (KP.Sounds as Record<string, unknown>)[id];
        if (typeof named === "function") (named as () => void)();
        else KP.Sounds.Library.playRand(id);
      },
    },
    state: {
      get color() {
        return KP.Current.color;
      },
      get altColor() {
        return KP.Current.altColor ?? KP.Current.color;
      },
      get scaling() {
        return KP.Current.scaling;
      },
      get multiplier() {
        return KP.Current.multiplier ?? 1;
      },
      texture: (c: string) => KP.Textures.Solid(c),
    },
    rng: Math.random,
    commit: () => KP.Display.saveMain(),
  };
}

export function bridgeTool(core: Tool, KP: KiddoPaintLike): LegacyTool {
  const pt = (ev: LegacyEvent) => ({ x: ev._x, y: ev._y });
  return {
    mousedown: (ev) => core.onPointerDown?.(pt(ev), contextFrom(KP)),
    mousemove: (ev) => core.onPointerMove?.(pt(ev), contextFrom(KP)),
    mouseup: (ev) => core.onPointerUp?.(pt(ev), contextFrom(KP)),
  };
}
