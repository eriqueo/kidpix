import {
  HIDDEN_PICTURE_RECORD_VERSION,
  createIndexedDbHiddenPictureStore,
  createMemoryHiddenPictureStore,
  type HiddenPictureMutation,
  type HiddenPictureRecord,
  type HiddenPictureStore,
} from "./hidden-pictures/store";

const MAX_PROCESSED_SIDE = 400;
const IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/bmp,image/webp";

interface DecodedImageImport {
  decodeFile(file: File): Promise<HTMLImageElement>;
}

interface HiddenPictureTool {
  hiddenPictures: string[];
  setCustomPictures(sources: string[]): void;
  usePicture(source: string): Promise<string>;
}

interface KiddoPaintWithHiddenPictures {
  Current: { tool: unknown };
  Display: { canvas: HTMLCanvasElement };
  ImageImport: DecodedImageImport;
  Tools: { EraserHiddenPicture: HiddenPictureTool };
  HiddenPictures?: HiddenPicturesApi;
}

interface DitherPort {
  atkinson(data: ImageData): ImageData;
}

interface HiddenPicturesApi {
  ready: Promise<void>;
  openPicker(): void;
  addFromFile(file: File): Promise<void>;
  getCustomPictures(): HiddenPictureRecord[];
}

function processedTitle(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, "").trim();
  return (withoutExtension || "My Hidden Picture").slice(0, 100);
}

function processPicture(
  image: HTMLImageElement,
  dither: DitherPort,
): string {
  const scale = Math.min(
    1,
    MAX_PROCESSED_SIDE / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas processing is unavailable");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.drawImage(image, 0, 0, width, height);
  const processed = dither.atkinson(context.getImageData(0, 0, width, height));
  context.putImageData(processed, 0, 0);
  return canvas.toDataURL("image/png");
}

async function contentKey(dataUrl: string): Promise<string> {
  const bytes = new TextEncoder().encode(dataUrl);
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const digest = await subtle.digest("SHA-256", bytes);
    return (
      "hp-" +
      [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
    );
  }

  // Deterministic 256-bit fallback for IDB-less/insecure contexts. The record
  // key is for local idempotency, not authentication.
  const hashes = [
    0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f,
    0x165667b1, 0xd3a2646c, 0xfd7046c5,
  ];
  for (let index = 0; index < bytes.length; index++) {
    for (let lane = 0; lane < hashes.length; lane++) {
      hashes[lane] = Math.imul(
        (hashes[lane] ?? 0) ^ (bytes[index] ?? 0) ^ lane,
        0x01000193 + lane * 2,
      );
    }
  }
  return (
    "hp-" +
    hashes.map((hash) => (hash >>> 0).toString(16).padStart(8, "0")).join("")
  );
}

const KP = (window as unknown as { KiddoPaint: KiddoPaintWithHiddenPictures })
  .KiddoPaint;
const dither = (window as unknown as { Dither: DitherPort }).Dither;
const tool = KP.Tools.EraserHiddenPicture;

let store: HiddenPictureStore;
let persistent = true;
let customPictures: HiddenPictureRecord[] = [];

try {
  store = createIndexedDbHiddenPictureStore();
} catch {
  store = createMemoryHiddenPictureStore();
  persistent = false;
}

function applyMutation(mutation: HiddenPictureMutation): void {
  customPictures = mutation.records;
  tool.setCustomPictures(customPictures.map((record) => record.dataUrl));
}

async function memoryFallback(): Promise<void> {
  const memory = createMemoryHiddenPictureStore();
  await memory.init();
  // Insert oldest-to-newest so the bounded queue retains the same records.
  for (const record of [...customPictures].reverse()) {
    await memory.addBounded(record);
  }
  store = memory;
  persistent = false;
}

function setStatus(message: string, buttonText?: string): void {
  const status = document.getElementById("statusbar-text");
  if (status) status.textContent = message;
  const button = document.querySelector<HTMLButtonElement>(
    '#genericsubmenu button[title="Add Picture Here"]',
  );
  if (button && buttonText) {
    button.setAttribute("aria-label", "Add Picture Here");
    button.textContent = buttonText;
  }
}

async function initialize(): Promise<void> {
  try {
    await store.init();
    customPictures = await store.list();
  } catch {
    await memoryFallback();
  }
  tool.setCustomPictures(customPictures.map((record) => record.dataUrl));
}

async function addFromFile(file: File): Promise<void> {
  await api.ready;
  try {
    setStatus("Turning your picture into a Hidden Picture…", "Adding Picture…");
    const image = await KP.ImageImport.decodeFile(file);
    const dataUrl = processPicture(image, dither);
    const record: HiddenPictureRecord = {
      version: HIDDEN_PICTURE_RECORD_VERSION,
      id: await contentKey(dataUrl),
      title: processedTitle(file.name),
      dataUrl,
      createdMs: Date.now(),
    };

    let mutation: HiddenPictureMutation;
    try {
      mutation = await store.addBounded(record);
    } catch {
      await memoryFallback();
      mutation = await store.addBounded(record);
    }
    applyMutation(mutation);
    await tool.usePicture(record.dataUrl);
    KP.Display.canvas.classList.value = "";
    KP.Display.canvas.classList.add("cursor-crosshair");
    KP.Current.tool = tool;

    const total = tool.hiddenPictures.length;
    let message = `Picture added! It is now one of ${total} Hidden Pictures.`;
    if (mutation.evicted) {
      message += " The oldest added picture was removed.";
    }
    if (!persistent) message += " It will stay for this session only.";
    setStatus(message, "Picture Added! Add Another");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    setStatus(`Could not add picture: ${reason}.`, "Try Add Picture Again");
  }
}

function ensureInput(): HTMLInputElement {
  let input = document.querySelector<HTMLInputElement>("#hidden-picture-input");
  if (input) return input;
  input = document.createElement("input");
  input.id = "hidden-picture-input";
  input.type = "file";
  input.accept = IMAGE_ACCEPT;
  input.hidden = true;
  input.addEventListener("change", () => {
    const file = input?.files?.[0];
    if (input) input.value = "";
    if (file) void addFromFile(file);
  });
  document.body.appendChild(input);
  return input;
}

const api: HiddenPicturesApi = {
  ready: Promise.resolve(),
  openPicker() {
    ensureInput().click();
  },
  addFromFile,
  getCustomPictures() {
    return [...customPictures];
  },
};

KP.HiddenPictures = api;
api.ready = initialize();

export { contentKey, processPicture, processedTitle };
