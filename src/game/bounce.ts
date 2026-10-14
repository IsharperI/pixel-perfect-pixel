/**
 * Bounce pads in the level being played. The level fills `bouncePads`; the
 * player checks it when landing, and the pad reads `boingAt` to squish.
 */
export type Pad = {
  id: string;
  /** Centre of the pad's top, and half its width/depth */
  x: number; z: number; top: number; hx: number; hz: number;
  /** How high it launches you, in blocks */
  height: number;
  /** When it last fired (seconds, performance.now() / 1000) */
  boingAt: number;
};

export const bouncePads: Pad[] = [];

/** The pad the player's feet are on, if any (centre x/z, feet height). */
export function padUnder(x: number, feet: number, z: number, pads: Pad[] = bouncePads): Pad | null {
  for (const p of pads) {
    if (Math.abs(x - p.x) <= p.hx + 0.2 && Math.abs(z - p.z) <= p.hz + 0.2 && Math.abs(feet - p.top) < 0.2) return p;
  }
  return null;
}

/** Launch speed to rise `height` under `gravity`. Holding jump as you land adds half again. */
export function bounceSpeed(height: number, gravity: number, boosted: boolean) {
  return Math.sqrt(2 * gravity * height * (boosted ? 1.5 : 1));
}

/** The pad's top plate squish at `t` seconds after firing: pushed down, then springs back with a wobble. */
export function squish(t: number) {
  if (t < 0 || t > 0.6) return 0;
  return Math.exp(-7 * t) * Math.cos(t * 22) * 0.6;
}
