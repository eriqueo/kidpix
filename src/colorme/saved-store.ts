/**
 * SavedColoringStore — persistence for ColorMe pages so a child can save the
 * page they're coloring and reopen it later to keep going. Survives reloads,
 * unlike the session-only per-page snapshots in js/tools/colorme.js.
 *
 * Mirrors src/slideshow/store.ts on purpose (same dialect): a pure in-memory
 * impl for tests / IDB-less environments, and an IndexedDB adapter for prod.
 * Boundary validation (isSavedColoring) is applied at put() so callers can
 * trust the shapes coming back out. IndexedDB rather than localStorage because
 * each saved page is a full-canvas PNG (~1-2 MB) — many of them would blow the
 * ~5 MB localStorage cap, whereas IDB has orders of magnitude more headroom.
 */

export type SavedColoringId = string;

export interface SavedColoring {
  id: SavedColoringId;
  /** Human label, defaulted from the source page title. */
  title: string;
  /** Full-canvas PNG data URL of the coloring (paper + line art + fills). */
  dataUrl: string;
  createdMs: number;
}

export function isSavedColoring(x: unknown): x is SavedColoring {
  if (!x || typeof x !== "object") return false;
  const p = x as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.title === "string" &&
    typeof p.dataUrl === "string" &&
    typeof p.createdMs === "number"
  );
}

export interface SavedColoringStore {
  init(): Promise<void>;
  /** Saved pages, newest first. */
  list(): Promise<SavedColoring[]>;
  put(p: SavedColoring): Promise<void>;
  delete(id: SavedColoringId): Promise<void>;
}

/* -------------------------------------------------------------------------- */
/* In-memory store (tests + IDB-less environments).                            */
/* -------------------------------------------------------------------------- */

export function createMemoryStore(): SavedColoringStore {
  const pages = new Map<SavedColoringId, SavedColoring>();
  return {
    async init() {},
    async list() {
      return [...pages.values()].sort((a, b) => b.createdMs - a.createdMs);
    },
    async put(p) {
      if (!isSavedColoring(p)) throw new Error("put: invalid SavedColoring");
      pages.set(p.id, p);
    },
    async delete(id) {
      pages.delete(id);
    },
  };
}

/* -------------------------------------------------------------------------- */
/* IndexedDB store (production).                                               */
/* -------------------------------------------------------------------------- */

const DB_NAME = "kidpix-colorme";
const DB_VERSION = 1;
const STORE_PAGES = "saved-pages";

export interface IndexedDbStoreOpts {
  /** Test seam — defaults to `globalThis.indexedDB`. */
  factory?: IDBFactory;
}

export function createIndexedDbStore(
  opts: IndexedDbStoreOpts = {},
): SavedColoringStore {
  const factory =
    opts.factory ?? (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (!factory) throw new Error("IndexedDB not available");

  let dbPromise: Promise<IDBDatabase> | null = null;

  function openDb(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = factory!.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_PAGES))
          db.createObjectStore(STORE_PAGES, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx<T>(
    mode: IDBTransactionMode,
    body: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    return openDb().then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const t = db.transaction(STORE_PAGES, mode);
          const out = body(t.objectStore(STORE_PAGES));
          out.onsuccess = () => resolve(out.result);
          out.onerror = () => reject(out.error);
        }),
    );
  }

  return {
    async init() {
      await openDb();
    },
    async list() {
      const all = await tx<SavedColoring[]>(
        "readonly",
        (s) => s.getAll() as IDBRequest<SavedColoring[]>,
      );
      return all
        .filter(isSavedColoring)
        .sort((a, b) => b.createdMs - a.createdMs);
    },
    async put(p) {
      if (!isSavedColoring(p)) throw new Error("put: invalid SavedColoring");
      await tx("readwrite", (s) => s.put(p));
    },
    async delete(id) {
      await tx("readwrite", (s) => s.delete(id));
    },
  };
}
