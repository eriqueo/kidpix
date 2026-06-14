import type { SoundDef } from "./sound-registry";

/**
 * 🔊 ADD YOUR FUNNY SOUNDS HERE.
 *
 * 1. Drop an audio file under `src/assets/snd/<folder>/your-sound.mp3`
 *    (it is served at runtime from the path WITHOUT the `src/assets/` prefix).
 * 2. Add ONE entry below:
 *      • new named sound:   { id: "fart",   files: ["snd/custom/fart.mp3"] }
 *      • extra variant of an existing sound (plays at random):
 *                           { appendTo: "oops", files: ["snd/custom/ohno.mp3"] }
 *
 * Existing sound names you can `appendTo` include: "oops" (the undo "Oh No!"),
 * "explosion", "stamp", "paintcan", "pencil", "bubblepops", … (see js/sounds/sounds.js).
 *
 * To bind a NEW named sound to a tool, call `KiddoPaint.Sounds.Library.playRand("fart")`
 * from that tool — or ask Claude to wire it.
 */
export const customSounds: SoundDef[] = [
  // Sample (safe to remove): an extra, on-theme "Oh No!" variant on undo.
  // The original 4 still play — this just adds a 5th random possibility.
  { appendTo: "oops", files: ["snd/eraser/doorbell-wwoooowwww.mp3"] },
];
