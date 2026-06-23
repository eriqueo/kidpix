import { describe, it, expect } from "vitest";
import {
  createMemoryStore,
  isSavedColoring,
  type SavedColoring,
} from "./saved-store";

function page(id: string, createdMs = 0): SavedColoring {
  return { id, title: id, dataUrl: "data:,", createdMs };
}

describe("SavedColoringStore (memory)", () => {
  it("puts, lists newest-first, and deletes", async () => {
    const s = createMemoryStore();
    await s.init();
    expect(await s.list()).toEqual([]);

    await s.put(page("a", 100));
    await s.put(page("b", 300));
    await s.put(page("c", 200));

    expect((await s.list()).map((p) => p.id)).toEqual(["b", "c", "a"]);

    await s.delete("b");
    expect((await s.list()).map((p) => p.id)).toEqual(["c", "a"]);
  });

  it("overwrites an entry when put with the same id", async () => {
    const s = createMemoryStore();
    await s.put(page("a", 1));
    await s.put({ id: "a", title: "renamed", dataUrl: "data:,x", createdMs: 9 });
    const list = await s.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: "a", title: "renamed" });
  });

  it("rejects invalid shapes at the boundary", async () => {
    const s = createMemoryStore();
    await expect(
      s.put({ id: "a", title: "x" } as unknown as SavedColoring),
    ).rejects.toThrow();
  });
});

describe("isSavedColoring", () => {
  it("accepts a well-formed page and rejects junk", () => {
    expect(isSavedColoring(page("a"))).toBe(true);
    expect(isSavedColoring(null)).toBe(false);
    expect(isSavedColoring({ id: "a", title: "x", dataUrl: 5 })).toBe(false);
    expect(isSavedColoring({ id: "a", title: "x", dataUrl: "d" })).toBe(false);
  });
});
