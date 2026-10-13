/**
 * Moving (and tilting) platforms that carry the player. Each platform registers its collider
 * and, every frame (before the player moves), how far it moved. The player adds
 * that movement when standing on it, and marks it as stood on (for platforms
 * that wait until you step on them). After the player has moved, each platform
 * is placed at its new position directly (not given a velocity), so the physics
 * engine doesn't also try to carry the player and move them twice.
 *
 * The player's collision check leaves moving platforms out and treats them as
 * simple boxes instead (using the centre and size here): stand on the top, get
 * pushed out of the sides. The physics engine's character controller tends to
 * wedge itself against moving bodies it touches, so walking off one needed a jump.
 */
export type Carrier = {
  /** The platform's collider */
  handle: number;
  /** How far it moved this frame */
  dx: number; dy: number; dz: number;
  /** Where its centre is now, and half its size (after rotation) */
  x: number; y: number; z: number;
  hx: number; hy: number; hz: number;
  /** Which way its top faces (straight up unless it's a tilting platform) */
  nx: number; ny: number; nz: number;
  stoodOn: boolean;
  /** Put the platform at its new position (called after the player has moved this frame) */
  commit: () => void;
};

export const carriers = new Map<number, Carrier>();

/** Height of a platform's top surface at (x, z) (its top can be tilted, about its centre). */
export function topAt(pl: Carrier, x: number, z: number) {
  return pl.y + (pl.hy - pl.nx * (x - pl.x) - pl.nz * (z - pl.z)) / Math.max(pl.ny, 0.2);
}
