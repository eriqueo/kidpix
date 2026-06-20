import { CATEGORIES, type Category, type Corpus, type DrawMePrompt, type PromptPart } from "./schema";
import { CORPUS } from "./corpus";

/**
 * Mulberry32 — small, deterministic, well-distributed RNG. Used here to
 * isolate DrawMe from any shared Math.random so tests are reproducible and
 * behavior is auditable (killVector: seedable RNG isolated from host runtime).
 */
export function createSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return function rng(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: readonly T[], rng: () => number): T {
  if (arr.length === 0) throw new Error("DrawMe: empty category — corpus is missing entries");
  const i = Math.floor(rng() * arr.length);
  return arr[Math.min(i, arr.length - 1)]!;
}

function articleFor(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function compose(parts: readonly PromptPart[]): string {
  const byCat = new Map<Category, string>(parts.map((p) => [p.category, p.value]));
  const adjective = byCat.get("adjective")!;
  const subject = byCat.get("subject")!;
  const action = byCat.get("action")!;
  const scene = byCat.get("scene")!;
  const article = articleFor(adjective);
  return `Draw ${article} ${adjective} ${subject} ${action} ${scene}.`;
}

export interface GenerateOptions {
  readonly seed: number;
  readonly corpus?: Corpus;
}

/**
 * Generate one DrawMe prompt deterministically from a seed.
 *
 * Every slot in CATEGORIES is filled (category coverage). With a fixed seed
 * the output is byte-stable across runs. No shared Math.random involved.
 */
export function generatePrompt({ seed, corpus = CORPUS }: GenerateOptions): DrawMePrompt {
  const rng = createSeededRng(seed);
  const parts: PromptPart[] = CATEGORIES.map((category) => ({
    category,
    value: pick(corpus[category], rng),
  }));
  return { text: compose(parts), parts, seed };
}

/**
 * Generate a prompt with a fresh seed each call. The host supplies the seed
 * source — defaults to a Date.now-based seed for the UI hook. Tests should
 * always use `generatePrompt` with an explicit seed.
 */
export function generateRandomPrompt(seedSource: () => number = () => Date.now()): DrawMePrompt {
  return generatePrompt({ seed: seedSource() >>> 0 });
}
