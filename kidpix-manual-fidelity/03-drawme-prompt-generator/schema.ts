/**
 * DrawMe prompt schema.
 *
 * The classic KidPix DrawMe (Switcheroo menu) suggested a "fantasy scene to
 * draw" via "Chaos Randomizing" — short phrases freshly mixed from a small
 * vocabulary, yielding thousands of suggestions. The structure is mad-libs:
 * a few slot categories (adjective, subject, action, scene) combined into one
 * sentence.
 *
 * This module reproduces that *style* with original vocabulary (no verbatim
 * KidPix text). The schema below is what the generator + tests both consume.
 */

export type Category = "adjective" | "subject" | "action" | "scene";

/** Ordered list of slots used to build a prompt. Order = sentence order. */
export const CATEGORIES: readonly Category[] = [
  "adjective",
  "subject",
  "action",
  "scene",
] as const;

export interface Corpus {
  readonly adjective: readonly string[];
  readonly subject: readonly string[];
  readonly action: readonly string[];
  readonly scene: readonly string[];
}

export interface PromptPart {
  readonly category: Category;
  readonly value: string;
}

export interface DrawMePrompt {
  /** Human-facing sentence, e.g. "Draw a silly dog dancing on the moon." */
  readonly text: string;
  /** Resolved slot values, in CATEGORIES order — for tests and audits. */
  readonly parts: readonly PromptPart[];
  /** RNG seed used to produce this prompt — for reproducibility. */
  readonly seed: number;
}
