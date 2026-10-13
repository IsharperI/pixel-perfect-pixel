/**
 * Seesaw (tilting) platforms: tip toward wherever the player stands, about a
 * pivot in the middle, and level out again when they step off. Plain maths so
 * it can be tested.
 */
import { PIECES, type PieceId } from "./pieces";

/** How far a tilting platform can tip, in radians (about 22°). */
export const MAX_TILT = (22 * Math.PI) / 180;
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
 * (relative to its centre). Standing further out tips it further, up to MAX_TILT.
 * Returns [about local x, about local z] in radians; positive "about x" tips +z down,
 * negative "about z" tips +x down.
 */
export function tiltTarget(piece: PieceId, lx: number, lz: number): [number, number] {
  const [w, , l] = PIECES[piece].size;
  const { aboutX, aboutZ } = tiltAxes(piece);
  const k = (v: number, half: number) => Math.max(-1, Math.min(1, v / half));
  return [aboutX ? MAX_TILT * k(lz, l / 2) : 0, aboutZ ? -MAX_TILT * k(lx, w / 2) : 0];
}

/** World → platform frame for a quarter-turn rotation `rot` about the vertical. */
export function toLocal(dx: number, dz: number, rot: number): [number, number] {
  const a = (-rot * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a);
  return [dx * c + dz * s, -dx * s + dz * c];
}

/** Ease `from` toward `to` (exponential smoothing at `rate` per second). */
export const approach = (from: number, to: number, rate: number, dt: number) => to + (from - to) * Math.exp(-rate * dt);
