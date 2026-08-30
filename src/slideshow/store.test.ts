import { describe, it, expect } from "vitest";
import { createMemoryStore, filePictureIfNew, seedFromLegacy } from "./store";
import type { Picture, Slideshow } from "./types";

function pic(id: string, name = id): Picture {
  return { id, name, dataUrl: "data:,", createdMs: Date.now() };
}

function show(id: string): Slideshow {
  const now = Date.now();
  return { id, name: id, slides: [], createdMs: now, updatedMs: now };
}

describe("SlideshowStore (memory)", () => {
  it("CRUDs pictures", async () => {
    const s = createMemoryStore();
    await s.init();
    expect(await s.listPictures()).toEqual([]);
    await s.putPicture(pic("a"));
    await s.putPicture(pic("b"));
    expect(await s.getPicture("a")).toMatchObject({ id: "a" });
    expect((await s.listPictures()).map((p) => p.id).sort()).toEqual(["a", "b"]);
    await s.deletePicture("a");
    expect(await s.getPicture("a")).toBeUndefined();
  });

  it("CRUDs slideshows", async () => {
    const s = createMemoryStore();
    await s.putSlideshow(show("ss1"));
    await s.putSlideshow(show("ss2"));
    expect((await s.listSlideshows()).map((x) => x.id).sort()).toEqual(["ss1", "ss2"]);
    await s.deleteSlideshow("ss1");
    expect(await s.getSlideshow("ss1")).toBeUndefined();
  });

  it("rejects invalid Picture at the boundary", async () => {
    const s = createMemoryStore();
    await expect(
      s.putPicture({ id: "x" } as unknown as Picture),
    ).rejects.toThrow(/invalid/i);
  });

  it("rejects invalid Slideshow at the boundary", async () => {
    const s = createMemoryStore();
    await expect(
      s.putSlideshow({ id: "x", name: "x", slides: [{ id: "s", pictureId: "p", transition: "BOGUS", transitionMs: 0, durationMs: 0 } as unknown as never], createdMs: 0, updatedMs: 0 } as Slideshow),
    ).rejects.toThrow(/invalid/i);
  });

  it("seedFromLegacy seeds an empty library once, named 'Last saved'", async () => {
    const s = createMemoryStore();
    const legacy = { getItem: (k: string) => (k === "kiddopaint" ? "data:image/png;base64,LEGACY" : null) };
    await seedFromLegacy(s, legacy);
    await seedFromLegacy(s, legacy);
    const all = await s.listPictures();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ name: "Last saved", dataUrl: "data:image/png;base64,LEGACY" });
  });

  it("seedFromLegacy leaves a non-empty library alone", async () => {
    const s = createMemoryStore();
    await s.putPicture(pic("a"));
    await seedFromLegacy(s, { getItem: () => "data:image/png;base64,LEGACY" });
    expect((await s.listPictures()).map((p) => p.id)).toEqual(["a"]);
  });

  it("filePictureIfNew skips a capture identical to the newest picture, across instances", async () => {
    const s = createMemoryStore();
    expect(await filePictureIfNew(s, "data:1", 100)).toBe(true);
    expect(await filePictureIfNew(s, "data:1", 200)).toBe(false);
    expect(await filePictureIfNew(s, "data:2", 300)).toBe(true);
    // Same bytes as an OLDER picture still file: only the newest is the dedupe key.
    expect(await filePictureIfNew(s, "data:1", 400)).toBe(true);
    expect(await s.listPictures()).toHaveLength(3);
  });

  it("totalSoundBytes sums all stored sound blob lengths", async () => {
    const s = createMemoryStore();
    await s.putSound({ id: "s1", name: "a", mime: "audio/wav", bytes: new ArrayBuffer(10), createdMs: 0 });
    await s.putSound({ id: "s2", name: "b", mime: "audio/wav", bytes: new ArrayBuffer(30), createdMs: 0 });
    expect(await s.totalSoundBytes()).toBe(40);
  });
});
