import { describe, it, expect, vi } from "vitest";
import { registerSounds, type SoundLibrary } from "./sound-registry";

// Fake audio factory — proves the registry needs no real Audio/DOM.
const fakeAudio = (url: string) => ({ url, play: vi.fn() });

describe("registerSounds", () => {
  it("creates a new named sound from files", () => {
    const lib: SoundLibrary = {};
    const r = registerSounds(lib, [{ id: "fart", files: ["a.mp3", "b.mp3"] }], fakeAudio);

    expect(r.added).toEqual(["fart"]);
    expect(r.appended).toEqual([]);
    expect((lib.fart as unknown[]).length).toBe(2);
  });

  it("appends variants to an existing sound without dropping originals", () => {
    const lib: SoundLibrary = { oops: [fakeAudio("orig.mp3")] };
    const r = registerSounds(lib, [{ appendTo: "oops", files: ["extra.mp3"] }], fakeAudio);

    expect(r.appended).toEqual(["oops"]);
    expect((lib.oops as unknown[]).length).toBe(2); // original kept + 1 added
  });

  it("creates the target array when appendTo points at a missing sound", () => {
    const lib: SoundLibrary = {};
    registerSounds(lib, [{ appendTo: "new", files: ["x.mp3"] }], fakeAudio);
    expect((lib.new as unknown[]).length).toBe(1);
  });

  it("only constructs audio lazily-per-file via the injected factory", () => {
    const factory = vi.fn(fakeAudio);
    registerSounds({}, [{ id: "s", files: ["1.mp3", "2.mp3", "3.mp3"] }], factory);
    expect(factory).toHaveBeenCalledTimes(3);
  });
});
