/**
 * WebM export (v1) — record the player canvas + an audio destination via
 * `MediaRecorder`. Gracefully returns null when unsupported so the UI can hide
 * the button.
 */
export interface CaptureHandle {
  stop(): Promise<Blob>;
}

export function captureSupported(): boolean {
  const g = globalThis as {
    MediaRecorder?: typeof MediaRecorder;
    HTMLCanvasElement?: typeof HTMLCanvasElement;
  };
  return !!g.MediaRecorder && !!g.HTMLCanvasElement &&
    typeof (g.HTMLCanvasElement.prototype as { captureStream?: () => MediaStream }).captureStream === "function";
}

export function startCanvasCapture(canvas: HTMLCanvasElement, fps = 30): CaptureHandle | null {
  if (!captureSupported()) return null;
  const stream = canvas.captureStream(fps);
  const mime = chooseMime();
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };
  recorder.start();

  return {
    stop() {
      return new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mime || "video/webm" }));
        recorder.stop();
      });
    },
  };
}

function chooseMime(): string | undefined {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  const MR = (globalThis as { MediaRecorder?: typeof MediaRecorder }).MediaRecorder;
  if (!MR || typeof MR.isTypeSupported !== "function") return undefined;
  for (const m of candidates) {
    try {
      if (MR.isTypeSupported(m)) return m;
    } catch {
      // ignore
    }
  }
  return undefined;
}
