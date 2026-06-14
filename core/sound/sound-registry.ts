/**
 * Data-driven sound registry (Phase 1).
 *
 * Hexagonal-style: pure logic with the audio creation INJECTED as a port
 * (`AudioFactory`), so it is fully testable in Node with zero DOM/Audio. The
 * legacy engine stores sounds as `KiddoPaint.Sounds.Library[name] = [Audio,…]`
 * and plays them via `playRand` (random element). This registry layers on top
 * of that contract — additive, no changes to the legacy sounds.js.
 */

/** The only capability we need from an audio object — a tiny outbound port. */
export interface PlayableAudio {
  play(): void | Promise<void>;
}

/** Port: turn a URL into something playable (e.g. `(url) => new Audio(url)`). */
export type AudioFactory = (url: string) => PlayableAudio;

/** The legacy Library shape, narrowed to what we touch. */
export interface SoundLibrary {
  [name: string]: PlayableAudio[] | unknown;
}

/** Create a brand-new named sound: `KiddoPaint.Sounds.Library[id] = [...]`. */
export interface NewSoundDef {
  id: string;
  files: string[];
}

/** Add extra random variants to an EXISTING sound (e.g. the undo "oops"). */
export interface AppendSoundDef {
  appendTo: string;
  files: string[];
}

export type SoundDef = NewSoundDef | AppendSoundDef;

function isAppend(def: SoundDef): def is AppendSoundDef {
  return (def as AppendSoundDef).appendTo !== undefined;
}

export interface RegisterResult {
  added: string[];
  appended: string[];
}

/**
 * Register sound definitions into a legacy-compatible Library.
 * Returns which ids were created vs appended (useful for tests/logging).
 */
export function registerSounds(
  library: SoundLibrary,
  defs: readonly SoundDef[],
  makeAudio: AudioFactory,
): RegisterResult {
  const result: RegisterResult = { added: [], appended: [] };

  for (const def of defs) {
    if (isAppend(def)) {
      const existing = Array.isArray(library[def.appendTo])
        ? (library[def.appendTo] as PlayableAudio[])
        : ((library[def.appendTo] = [] as PlayableAudio[]));
      for (const file of def.files) existing.push(makeAudio(file));
      result.appended.push(def.appendTo);
    } else {
      library[def.id] = def.files.map(makeAudio);
      result.added.push(def.id);
    }
  }

  return result;
}
