/**
 * Seesaw (tilting) platforms: tip toward wherever the player stands, about a
 * pivot in the middle, and level out again when they step off. Plain maths so
 * it can be tested.
 */
import { PIECES, type PieceId } from "./pieces";

/** How far a tilting platform tips, in degrees: the default, and the slider's range. */
export const DEFAULT_TILT = 22, TILT_MIN = 5, TILT_MAX = 75, TILT_STEP = 5;
const rad = (deg: number) => (deg * Math.PI) / 180;
/** The default tip, in radians. */
export const MAX_TILT = rad(DEFAULT_TILT);

/** Clean up a tilt setting read from a file (older files just had `true`). */
export function readTilt(raw: unknown): { max: number } | undefined {
  if (raw === true) return { max: DEFAULT_TILT };
  if (!raw || typeof raw !== "object") return undefined;
  const m = (raw as Record<string, unknown>)["max"];
  const max = typeof m === "number" && Number.isFinite(m) ? m : DEFAULT_TILT;
  return { max: Math.min(TILT_MAX, Math.max(TILT_MIN, Math.round(max))) };
}
/** How quickly it tips under you, and how slowly it levels out after. */
export const TIP_RATE = 2.5, LEVEL_RATE = 1.2;

/**
 * Which ways a piece can tip (in its own unrotated frame): a plank tips end to end
 * (about its local z axis); square pieces tip any way.
 */
export function tiltAxes(piece: PieceId) {
  const [w, , l] = PIECES[piece].size;
  return { aboutX: l >= w, aboutZ: w >= l };
}

/**
 * The tilt to aim for with the player standing at (lx, lz) in the platform's own frame
 * (relative to its centre). Standing further out tips it further, up to `maxDeg` degrees.
 * Returns [about local x, about local z] in radians; positive "about x" tips +z down,
 * negative "about z" tips +x down.
 */
export function tiltTarget(piece: PieceId, lx: number, lz: number, maxDeg = DEFAULT_TILT): [number, number] {
  const [w, , l] = PIECES[piece].size;
  const { aboutX, aboutZ } = tiltAxes(piece);
  const k = (v: number, half: number) => Math.max(-1, Math.min(1, v / half));
  const max = rad(maxDeg);
  return [aboutX ? max * k(lz, l / 2) : 0, aboutZ ? -max * k(lx, w / 2) : 0];
}

/** The tilt when tipped all the way toward its +z / -x end (for the editor's preview). */
export function fullTilt(piece: PieceId, maxDeg: number): [number, number] {
  const { aboutX } = tiltAxes(piece);
  return aboutX ? [rad(maxDeg), 0] : [0, -rad(maxDeg)];
}

/** World → platform frame for a quarter-turn rotation `rot` about the vertical. */
export function toLocal(dx: number, dz: number, rot: number): [number, number] {
  const a = (-rot * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a);
  return [dx * c + dz * s, -dx * s + dz * c];
}

/** Ease `from` toward `to` (exponential smoothing at `rate` per second). */
export const approach = (from: number, to: number, rate: number, dt: number) => to + (from - to) * Math.exp(-rate * dt);
