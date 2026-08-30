import { describe, it, expect } from "vitest";
import {
  appendSlide,
  insertSlide,
  latestSlideshow,
  newPicture,
  newSlide,
  newSlideshow,
  removeSlide,
  reorderSlide,
  setTransition,
  totalDurationMs,
  updateSlide,
} from "./model";

const now = 1_700_000_000_000;

function seed() {
  let s = newSlideshow("test", now);
  s = appendSlide(s, newSlide("pic-a", { transitionMs: 100, durationMs: 1000 }), now);
  s = appendSlide(s, newSlide("pic-b", { transitionMs: 100, durationMs: 2000 }), now);
  s = appendSlide(s, newSlide("pic-c", { transitionMs: 100, durationMs: 3000 }), now);
  return s;
}

describe("SlideshowModel", () => {
  it("appends and removes slides", () => {
    let s = newSlideshow("x", now);
    expect(s.slides).toHaveLength(0);
    s = appendSlide(s, newSlide("p"));
    expect(s.slides).toHaveLength(1);
    s = removeSlide(s, s.slides[0].id);
    expect(s.slides).toHaveLength(0);
  });

  it("insert at index clamps within range", () => {
    let s = newSlideshow("x");
    s = insertSlide(s, newSlide("a"), 0);
    s = insertSlide(s, newSlide("b"), 999);
    s = insertSlide(s, newSlide("c"), -5);
    expect(s.slides.map((sl) => sl.pictureId)).toEqual(["c", "a", "b"]);
  });

  it("reorder moves an item from -> to", () => {
    const s = seed();
    const moved = reorderSlide(s, 0, 2);
    expect(moved.slides.map((sl) => sl.pictureId)).toEqual(["pic-b", "pic-c", "pic-a"]);
  });

  it("reorder is a no-op when from === to", () => {
    const s = seed();
    expect(reorderSlide(s, 1, 1)).toBe(s);
  });

  it("update enforces durationMs >= transitionMs", () => {
    const s = seed();
    const updated = updateSlide(s, s.slides[0].id, { transitionMs: 5000, durationMs: 100 });
    expect(updated.slides[0].durationMs).toBe(5000);
  });

  it("setTransition changes the transition id only", () => {
    const s = seed();
    const out = setTransition(s, s.slides[1].id, "iris");
    expect(out.slides[1].transition).toBe("iris");
    expect(out.slides[0].transition).toBe(s.slides[0].transition);
  });

  it("totalDurationMs sums durations", () => {
    expect(totalDurationMs(seed())).toBe(6000);
  });

  it("mutators are immutable (return new object)", () => {
    const s = seed();
    const out = appendSlide(s, newSlide("z"));
    expect(out).not.toBe(s);
    expect(s.slides).toHaveLength(3);
    expect(out.slides).toHaveLength(4);
  });

  it("newPicture yields a valid, uniquely-identified library Picture", () => {
    const a = newPicture("data:image/png;base64,AAA", now);
    const b = newPicture("data:image/png;base64,AAA", now);
    expect(a.id).not.toBe(b.id);
    expect(a).toMatchObject({ dataUrl: "data:image/png;base64,AAA", createdMs: now });
    expect(a.name).toMatch(/^Picture \d\d:\d\d:\d\d$/);
  });

  it("latestSlideshow picks the most recently updated show (reopen rule)", () => {
    expect(latestSlideshow([])).toBeUndefined();
    const older = { ...newSlideshow("old", now), updatedMs: now + 10 };
    const newer = { ...newSlideshow("new", now), updatedMs: now + 20 };
    expect(latestSlideshow([older, newer])?.name).toBe("new");
    expect(latestSlideshow([newer, older])?.name).toBe("new");
  });
});
