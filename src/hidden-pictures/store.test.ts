import { describe, expect, it } from "vitest";
import {
  HIDDEN_PICTURE_RECORD_VERSION,
  MAX_CUSTOM_HIDDEN_PICTURES,
  createMemoryHiddenPictureStore,
  isHiddenPictureRecord,
  type HiddenPictureRecord,
} from "./store";

function record(index: number): HiddenPictureRecord {
  return {
    version: HIDDEN_PICTURE_RECORD_VERSION,
    id: "hp-" + index.toString(16).padStart(64, "0"),
    title: `Picture ${index}`,
    dataUrl: "data:image/png;base64," + index.toString(36),
    createdMs: index,
  };
}

describe("HiddenPictureStore", () => {
  it("accepts only the current bounded PNG record format", () => {
    expect(isHiddenPictureRecord(record(1))).toBe(true);
    expect(isHiddenPictureRecord({ ...record(1), version: 2 })).toBe(false);
    expect(isHiddenPictureRecord({ ...record(1), id: "random" })).toBe(false);
    expect(isHiddenPictureRecord({ ...record(1), dataUrl: "data:image/jpeg;base64,x" })).toBe(
      false,
    );
  });

  it("keeps 20 custom pictures and evicts the oldest at the limit", async () => {
    const store = createMemoryHiddenPictureStore();
    for (let index = 0; index < MAX_CUSTOM_HIDDEN_PICTURES; index++) {
      const mutation = await store.addBounded(record(index));
      expect(mutation.evicted).toBeNull();
    }

    const mutation = await store.addBounded(record(MAX_CUSTOM_HIDDEN_PICTURES));
    expect(mutation.records).toHaveLength(MAX_CUSTOM_HIDDEN_PICTURES);
    expect(mutation.evicted?.id).toBe(record(0).id);
    expect(mutation.records.map((item) => item.id)).not.toContain(record(0).id);
  });

  it("updates a content-keyed record without growing or evicting the queue", async () => {
    const store = createMemoryHiddenPictureStore();
    await store.addBounded(record(1));
    const mutation = await store.addBounded({
      ...record(1),
      title: "Same picture, newer title",
      createdMs: 10,
    });

    expect(mutation.evicted).toBeNull();
    expect(mutation.records).toEqual([
      expect.objectContaining({ title: "Same picture, newer title", createdMs: 10 }),
    ]);
  });
});
