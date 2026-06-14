/**
 * The hexagonal contract (Phase 2): the Tool interface plus the outbound ports
 * a tool may use. Nothing here imports DOM/canvas/audio — a tool is pure logic
 * driven by `(pointer, ToolContext)` and testable headless with fakes.
 * Adapters/ implement these ports over the real browser APIs (and the legacy engine).
 */

export interface Point {
  x: number;
  y: number;
}

export type StrokeStyle = string | CanvasGradient | CanvasPattern;

export interface StrokeOpts {
  strokeStyle: StrokeStyle;
  width: number;
  cap?: CanvasLineCap;
  join?: CanvasLineJoin;
}

/**
 * Renderer port — "draw intent", not raw canvas calls. Canvas2DRenderer is the
 * default adapter. `raw` is the deliberate escape hatch (Premortem #5) for tools
 * that genuinely need globalAlpha / compositing / ImageData readback; reaching
 * for it is allowed but should be rare and called out.
 */
export interface Renderer {
  beginPath(): void;
  closePath(): void;
  setStroke(opts: StrokeOpts): void;
  moveTo(p: Point): void;
  lineTo(p: Point): void;
  stroke(): void;
  /** Clear the scratch (tmp) layer — used by preview tools between moves.
   *  Bridged to the legacy clearTmp(), which respects Display.allowClearTmp. */
  clear(): void;
  readonly raw?: CanvasRenderingContext2D;
}

/** Sound port — play a registered sound by id (see core/sound). */
export interface SoundPort {
  play(id: string): void;
}

/** Read-only view of live drawing state (color model, scaling, texture). */
export interface DrawingStateView {
  readonly color: string;
  readonly altColor: string;
  readonly scaling: number;
  readonly multiplier: number;
  /** Active modifier (e.g. shift) — tools use it for constrain behavior. */
  readonly modified: boolean;
  /** Map a color to a strokeStyle via the active texture (legacy Textures.*). */
  texture(color: string): StrokeStyle;
}

/** Seedable randomness port — Math.random in prod, deterministic in tests. */
export type Rng = () => number;

export interface ToolContext {
  renderer: Renderer;
  sound: SoundPort;
  state: DrawingStateView;
  rng: Rng;
  /** Composite the scratch layer to the saved drawing (legacy saveMain). */
  commit(): void;
}

export interface ToolMeta {
  id: string;
  name: string;
  icon?: string;
  category?: string;
}

/**
 * A tool keeps the legacy pointer lifecycle so old tools wrap as a mechanical
 * lift. Instances may hold transient per-stroke state (like the legacy singletons).
 */
export interface Tool {
  readonly meta: ToolMeta;
  onPointerDown?(p: Point, ctx: ToolContext): void;
  onPointerMove?(p: Point, ctx: ToolContext): void;
  onPointerUp?(p: Point, ctx: ToolContext): void;
}
