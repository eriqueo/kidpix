import { describe, it, expect, vi } from "vitest";
import { createPlayer, type PlayerImageLoader } from "./player";
import { appendSlide, newSlide, newSlideshow } from "./model";
import type { DrawableSource } from "./transitions";

/**
 * Fully headless smoke test: fake clock + manual scheduler + a fake image
 * loader. Verifies the player advances slides, emits `start`/`slide`/`end`,
 * and stops at the end. No DOM, no rAF.
 */
function fakeImageLoader(): PlayerImageLoader {
  const fake: DrawableSource = { width: 800, height: 600 } as unknown as DrawableSource;
  return {
    load: vi.fn().mockResolvedValue(fake),
  };
}

function fakeCtx(): CanvasRenderingContext2D {
  const noop = () => undefined;
  return {
    save: noop,
    restore: noop,
    beginPath: noop,
    rect: noop,
    arc: noop,
    clip: noop,
    drawImage: noop,
    fillRect: noop,
    set globalAlpha(_v: number) {},
    set fillStyle(_v: string) {},
  } as unknown as CanvasRenderingContext2D;
}

describe("SlideshowPlayer", () => {
  it("advances slides on a fake clock and ends", async () => {
    let show = newSlideshow("t", 0);
    show = appendSlide(show, newSlide("a", { transitionMs: 100, durationMs: 500 }), 0);
    show = appendSlide(show, newSlide("b", { transitionMs: 100, durationMs: 500 }), 0);

    let nowMs = 0;
    const ticks: Array<(n: number) => void> = [];
    const events: string[] = [];

    const player = createPlayer({
      ctx: fakeCtx(),
      width: 800,
      height: 600,
      show,
      images: fakeImageLoader(),
      clock: () => nowMs,
      schedule: (cb) => {
        ticks.push(cb);
        return ticks.length;
      },
      cancel: () => {},
    });
    player.bus.on("start", () => events.push("start"));
    player.bus.on("slide", (p) => events.push(`slide:${p.index}`));
    player.bus.on("end", () => events.push("end"));

    player.start();
    // give the image loader microtasks a chance to settle
    await Promise.resolve();
    await Promise.resolve();

    // Drive the loop. Each scheduled tick is a frame at our current `nowMs`.
    function drive(steps: number) {
      for (let i = 0; i < steps; i++) {
        if (ticks.length === 0) return;
        const cb = ticks.shift()!;
        cb(nowMs);
      }
    }

    // Within slide 0: advance time below the duration — should not yet move on
    nowMs = 200;
    drive(1);
    expect(events).toContain("slide:0");
    expect(events).not.toContain("slide:1");

    // Cross slide 0's duration; player schedules slide 1, which loads async.
    nowMs = 600;
    drive(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(events).toContain("slide:1");

    // Cross slide 1's duration; player should end.
    nowMs = 1300;
    drive(2);
    await Promise.resolve();
    expect(events).toContain("end");
    expect(player.state()).toBe("ended");
  });

  it("ends immediately on an empty slideshow", () => {
    const show = newSlideshow("empty");
    const ended = vi.fn();
    const player = createPlayer({
      ctx: fakeCtx(),
      width: 100,
      height: 100,
      show,
      images: fakeImageLoader(),
      clock: () => 0,
      schedule: () => 0,
      cancel: () => {},
    });
    player.bus.on("end", ended);
    player.start();
    expect(ended).toHaveBeenCalled();
  });
});
