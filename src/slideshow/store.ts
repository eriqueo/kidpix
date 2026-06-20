/**
 * SlideshowStore — the only thing that talks to IndexedDB.
 *
 * Two implementations live here:
 *   - `createMemoryStore()`     pure JS, used in tests / environments without IDB.
 *   - `createIndexedDbStore()`  the production adapter.
 *
 * Both satisfy `SlideshowStore`. Boundary validation (isPicture/isSlideshow) is
 * applied at `put*` so internal modules can trust the shapes.
 */
import {
  isPicture,
  isSlideshow,
  type Picture,
  type PictureId,
  type Slideshow,
  type SoundBlob,
  type SoundId,
} from "./types";

export interface SlideshowStore {
  init(): Promise<void>;

  listPictures(): Promise<Picture[]>;
  getPicture(id: PictureId): Promise<Picture | undefined>;
  putPicture(p: Picture): Promise<void>;
  deletePicture(id: PictureId): Promise<void>;

  listSlideshows(): Promise<Slideshow[]>;
  getSlideshow(id: string): Promise<Slideshow | undefined>;
  putSlideshow(s: Slideshow): Promise<void>;
  deleteSlideshow(id: string): Promise<void>;

  getSound(id: SoundId): Promise<SoundBlob | undefined>;
  putSound(s: SoundBlob): Promise<void>;
  totalSoundBytes(): Promise<number>;
}

/* -------------------------------------------------------------------------- */
/* In-memory store (tests + IDB-less environments).                            */
/* -------------------------------------------------------------------------- */

export function createMemoryStore(): SlideshowStore {
  const pictures = new Map<PictureId, Picture>();
  const slideshows = new Map<string, Slideshow>();
  const sounds = new Map<SoundId, SoundBlob>();

  return {
    async init() {},

    async listPictures() {
      return [...pictures.values()].sort((a, b) => b.createdMs - a.createdMs);
    },
    async getPicture(id) {
      return pictures.get(id);
    },
    async putPicture(p) {
      if (!isPicture(p)) throw new Error("putPicture: invalid Picture");
      pictures.set(p.id, p);
    },
    async deletePicture(id) {
      pictures.delete(id);
    },

    async listSlideshows() {
      return [...slideshows.values()].sort((a, b) => b.updatedMs - a.updatedMs);
    },
    async getSlideshow(id) {
      return slideshows.get(id);
    },
    async putSlideshow(s) {
      if (!isSlideshow(s)) throw new Error("putSlideshow: invalid Slideshow");
      slideshows.set(s.id, s);
    },
    async deleteSlideshow(id) {
      slideshows.delete(id);
    },

    async getSound(id) {
      return sounds.get(id);
    },
    async putSound(s) {
      sounds.set(s.id, s);
    },
    async totalSoundBytes() {
      let total = 0;
      for (const s of sounds.values()) total += s.bytes.byteLength;
      return total;
    },
  };
}

/* -------------------------------------------------------------------------- */
/* IndexedDB store (production).                                               */
/* -------------------------------------------------------------------------- */

const DB_NAME = "kidpix-slideshow";
const DB_VERSION = 1;
const STORE_PICTURES = "pictures";
const STORE_SLIDESHOWS = "slideshows";
const STORE_SOUNDS = "sounds";

export interface IndexedDbStoreOpts {
  /** Set false to skip the legacy localStorage dual-read shim (tests). */
  importLegacy?: boolean;
  /** Test seam — defaults to `globalThis.indexedDB`. */
  factory?: IDBFactory;
  /** Test seam for the legacy localStorage. */
  legacyStorage?: Pick<Storage, "getItem">;
}

export function createIndexedDbStore(opts: IndexedDbStoreOpts = {}): SlideshowStore {
  const factory = opts.factory ?? (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (!factory) throw new Error("IndexedDB not available");

  let dbPromise: Promise<IDBDatabase> | null = null;

  function openDb(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = factory!.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_PICTURES))
          db.createObjectStore(STORE_PICTURES, { keyPath: "id" });
        if (!db.objectStoreNames.contains(STORE_SLIDESHOWS))
          db.createObjectStore(STORE_SLIDESHOWS, { keyPath: "id" });
        if (!db.objectStoreNames.contains(STORE_SOUNDS))
          db.createObjectStore(STORE_SOUNDS, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx<T>(
    storeName: string,
    mode: IDBTransactionMode,
    body: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
  ): Promise<T> {
    return openDb().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const t = db.transaction(storeName, mode);
          const store = t.objectStore(storeName);
          const out = body(store);
          if (out instanceof Promise) {
            out.then(resolve, reject);
            return;
          }
          out.onsuccess = () => resolve(out.result);
          out.onerror = () => reject(out.error);
        }),
    );
  }

  async function getAll<T>(storeName: string): Promise<T[]> {
    return tx<T[]>(storeName, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
  }

  async function importLegacyIfAny(store: SlideshowStore): Promise<void> {
    const legacy =
      opts.legacyStorage ??
      (globalThis as { localStorage?: Storage }).localStorage;
    if (!legacy) return;
    let dataUrl: string | null;
    try {
      dataUrl = legacy.getItem("kiddopaint");
    } catch {
      return;
    }
    if (!dataUrl) return;
    const existing = await store.listPictures();
    if (existing.some((p) => p.name === "Last saved (legacy)")) return;
    const now = Date.now();
    await store.putPicture({
      id: `pic-legacy-${now.toString(36)}`,
      name: "Last saved (legacy)",
      dataUrl,
      createdMs: now,
    });
  }

  const store: SlideshowStore = {
    async init() {
      await openDb();
      if (opts.importLegacy !== false) await importLegacyIfAny(store);
    },

    listPictures: () => getAll<Picture>(STORE_PICTURES),
    getPicture: (id) =>
      tx<Picture | undefined>(STORE_PICTURES, "readonly", (s) => s.get(id) as IDBRequest<Picture | undefined>),
    putPicture: async (p) => {
      if (!isPicture(p)) throw new Error("putPicture: invalid Picture");
      await tx(STORE_PICTURES, "readwrite", (s) => s.put(p));
    },
    deletePicture: async (id) => {
      await tx(STORE_PICTURES, "readwrite", (s) => s.delete(id));
    },

    listSlideshows: () => getAll<Slideshow>(STORE_SLIDESHOWS),
    getSlideshow: (id) =>
      tx<Slideshow | undefined>(STORE_SLIDESHOWS, "readonly", (s) => s.get(id) as IDBRequest<Slideshow | undefined>),
    putSlideshow: async (s) => {
      if (!isSlideshow(s)) throw new Error("putSlideshow: invalid Slideshow");
      await tx(STORE_SLIDESHOWS, "readwrite", (st) => st.put(s));
    },
    deleteSlideshow: async (id) => {
      await tx(STORE_SLIDESHOWS, "readwrite", (s) => s.delete(id));
    },

    getSound: (id) =>
      tx<SoundBlob | undefined>(STORE_SOUNDS, "readonly", (s) => s.get(id) as IDBRequest<SoundBlob | undefined>),
    putSound: async (s) => {
      await tx(STORE_SOUNDS, "readwrite", (st) => st.put(s));
    },
    async totalSoundBytes() {
      const all = await getAll<SoundBlob>(STORE_SOUNDS);
      let total = 0;
      for (const s of all) total += s.bytes.byteLength;
      return total;
    },
  };

  return store;
}
