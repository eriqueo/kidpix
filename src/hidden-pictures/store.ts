/**
 * Local custom Hidden Pictures are AUTO-MANAGED derived data. The original
 * image remains outside Kid Pix; this store retains at most 20 processed PNGs
 * and evicts the oldest custom record when a distinct picture reaches the cap.
 */

export const HIDDEN_PICTURE_RECORD_VERSION = 1 as const;
export const MAX_CUSTOM_HIDDEN_PICTURES = 20;
export const MAX_HIDDEN_PICTURE_DATA_URL_LENGTH = 1_000_000;

export interface HiddenPictureRecord {
  version: typeof HIDDEN_PICTURE_RECORD_VERSION;
  /** `hp-` plus a 64-hex processed-content fingerprint. */
  id: string;
  title: string;
  dataUrl: string;
  createdMs: number;
}

export interface HiddenPictureMutation {
  /** Authoritative post-mutation state, newest first. */
  records: HiddenPictureRecord[];
  evicted: HiddenPictureRecord | null;
}

export interface HiddenPictureStore {
  init(): Promise<void>;
  list(): Promise<HiddenPictureRecord[]>;
  addBounded(record: HiddenPictureRecord): Promise<HiddenPictureMutation>;
}

export class HiddenPictureStoreError extends Error {
  constructor(
    readonly code:
      | "invalid-record"
      | "indexeddb-unavailable"
      | "indexeddb-operation-failed",
    message: string,
  ) {
    super(message);
    this.name = "HiddenPictureStoreError";
  }
}

export function isHiddenPictureRecord(x: unknown): x is HiddenPictureRecord {
  if (!x || typeof x !== "object") return false;
  const record = x as Record<string, unknown>;
  return (
    record.version === HIDDEN_PICTURE_RECORD_VERSION &&
    typeof record.id === "string" &&
    /^hp-[0-9a-f]{64}$/.test(record.id) &&
    typeof record.title === "string" &&
    record.title.length > 0 &&
    record.title.length <= 100 &&
    typeof record.dataUrl === "string" &&
    record.dataUrl.startsWith("data:image/png;base64,") &&
    record.dataUrl.length <= MAX_HIDDEN_PICTURE_DATA_URL_LENGTH &&
    typeof record.createdMs === "number" &&
    Number.isFinite(record.createdMs) &&
    record.createdMs >= 0
  );
}

function newestFirst(records: HiddenPictureRecord[]): HiddenPictureRecord[] {
  return records.sort(
    (a, b) => b.createdMs - a.createdMs || a.id.localeCompare(b.id),
  );
}

function assertRecord(record: HiddenPictureRecord): void {
  if (!isHiddenPictureRecord(record)) {
    throw new HiddenPictureStoreError(
      "invalid-record",
      "Hidden Picture record is invalid",
    );
  }
}

export function createMemoryHiddenPictureStore(): HiddenPictureStore {
  const pictures = new Map<string, HiddenPictureRecord>();
  return {
    async init() {},
    async list() {
      return newestFirst([...pictures.values()]);
    },
    async addBounded(record) {
      assertRecord(record);
      let evicted: HiddenPictureRecord | null = null;
      if (!pictures.has(record.id) && pictures.size >= MAX_CUSTOM_HIDDEN_PICTURES) {
        const oldest = newestFirst([...pictures.values()]).at(-1);
        if (oldest) {
          pictures.delete(oldest.id);
          evicted = oldest;
        }
      }
      pictures.set(record.id, record);
      return { records: newestFirst([...pictures.values()]), evicted };
    },
  };
}

const DB_NAME = "kidpix-hidden-pictures";
const DB_VERSION = 1;
const STORE_PICTURES = "pictures";

export interface IndexedDbHiddenPictureStoreOptions {
  /** Composition-root test seam; defaults to the browser's IndexedDB factory. */
  factory?: IDBFactory;
}

export function createIndexedDbHiddenPictureStore(
  options: IndexedDbHiddenPictureStoreOptions = {},
): HiddenPictureStore {
  const factory =
    options.factory ?? (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  if (!factory) {
    throw new HiddenPictureStoreError(
      "indexeddb-unavailable",
      "IndexedDB is not available",
    );
  }
  const availableFactory = factory;

  let dbPromise: Promise<IDBDatabase> | null = null;

  function openDb(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = availableFactory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_PICTURES)) {
          request.result.createObjectStore(STORE_PICTURES, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(
          new HiddenPictureStoreError(
            "indexeddb-operation-failed",
            request.error?.message || "Could not open Hidden Pictures storage",
          ),
        );
    });
    return dbPromise;
  }

  async function list(): Promise<HiddenPictureRecord[]> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_PICTURES, "readonly");
      const request = transaction.objectStore(STORE_PICTURES).getAll();
      request.onsuccess = () =>
        resolve(newestFirst(request.result.filter(isHiddenPictureRecord)));
      request.onerror = () =>
        reject(
          new HiddenPictureStoreError(
            "indexeddb-operation-failed",
            request.error?.message || "Could not read Hidden Pictures",
          ),
        );
    });
  }

  return {
    async init() {
      await openDb();
    },
    list,
    async addBounded(record) {
      assertRecord(record);
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_PICTURES, "readwrite");
        const store = transaction.objectStore(STORE_PICTURES);
        const request = store.getAll();
        let mutation: HiddenPictureMutation | null = null;

        request.onsuccess = () => {
          const current = newestFirst(request.result.filter(isHiddenPictureRecord));
          const existing = current.find((item) => item.id === record.id);
          let evicted: HiddenPictureRecord | null = null;
          if (!existing && current.length >= MAX_CUSTOM_HIDDEN_PICTURES) {
            evicted = current.at(-1) ?? null;
            if (evicted) store.delete(evicted.id);
          }
          store.put(record);
          const remaining = current.filter(
            (item) => item.id !== record.id && item.id !== evicted?.id,
          );
          mutation = {
            records: newestFirst([...remaining, record]),
            evicted,
          };
        };
        transaction.oncomplete = () => {
          if (mutation) resolve(mutation);
          else {
            reject(
              new HiddenPictureStoreError(
                "indexeddb-operation-failed",
                "Hidden Pictures transaction completed without a result",
              ),
            );
          }
        };
        transaction.onerror = () =>
          reject(
            new HiddenPictureStoreError(
              "indexeddb-operation-failed",
              transaction.error?.message || "Could not save Hidden Picture",
            ),
          );
        transaction.onabort = transaction.onerror;
      });
    },
  };
}
