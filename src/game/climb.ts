/**
 * Climbable (vine-covered) block faces, and the geometry for grabbing and
 * climbing them. A level fills `climbFaces` while it's being played; the
 * player reads it. Only vertical sides can have vines.
 */
export type ClimbFace = {
  /** Outward direction of the face (a unit vector along x or z) */
  nx: number; nz: number;
  /** Where the face's plane is, measured along its outward direction */
  d: number;
  /** Extent along the face (x for faces facing ±z, z for faces facing ±x), and its height */
  t0: number; t1: number; y0: number; y1: number;
};

export const climbFaces: ClimbFace[] = [];

/** Where a point is relative to a face: distance in front of it, position along it. */
export function faceCoords(f: ClimbFace, x: number, z: number) {
  return { dist: x * f.nx + z * f.nz - f.d, t: f.nx !== 0 ? z : x };
}

/** The player's half height (centre to feet), and radius. Match Player.tsx. */
const HALF_H = 0.95, RAD = 0.45;

/** A vine face the player (body centre) can grab right now, if any: the nearest one in front of them. */
export function findGrab(x: number, y: number, z: number, faces: ClimbFace[] = climbFaces): ClimbFace | null {
  let best: ClimbFace | null = null, bestDist = Infinity;
  for (const f of faces) {
    const { dist, t } = faceCoords(f, x, z);
    if (dist < -0.05 || dist > RAD + 0.45) continue;
    if (t < f.t0 - 0.15 || t > f.t1 + 0.15) continue;
    if (y < f.y0 - HALF_H + 0.2 || y > f.y1 + 0.3) continue;
    if (dist < bestDist) { best = f; bestDist = dist; }
  }
  return best;
}

/**
 * Is there vine at (t, y) on the wall `f` is part of? (Faces in the same plane, facing the
 * same way, join up into one wall, so you can climb from block to block.)
 */
export function vineAt(f: ClimbFace, t: number, y: number, faces: ClimbFace[] = climbFaces) {
  return faces.some((g) => g.nx === f.nx && g.nz === f.nz && Math.abs(g.d - f.d) < 0.01 && t >= g.t0 - 0.05 && t <= g.t1 + 0.05 && y >= g.y0 && y <= g.y1);
}

/** The top of the wall at (t) above height y: where you'd pull yourself up. */
export function wallTop(f: ClimbFace, t: number, y: number, faces: ClimbFace[] = climbFaces) {
  let top = -Infinity;
  for (const g of faces) {
    if (g.nx !== f.nx || g.nz !== f.nz || Math.abs(g.d - f.d) > 0.01) continue;
    if (t < g.t0 - 0.05 || t > g.t1 + 0.05 || g.y1 < y - 1.5) continue;
    top = Math.max(top, g.y1);
  }
  return top;
}

/** Side faces bit flags, in a block's own (unrotated) frame. */
export const FACE = { px: 1, nx: 2, pz: 4, nz: 8 } as const;

/**
 * Turn a mask of faces in a block's own frame into world directions, for a block turned
 * `rot` quarter turns (the same turn the block is drawn with: +x becomes -z).
 */
export function rotateFaces(mask: number, rot: number) {
  let m = mask;
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) {
    m = (m & FACE.px ? FACE.nz : 0) | (m & FACE.nz ? FACE.nx : 0) | (m & FACE.nx ? FACE.pz : 0) | (m & FACE.pz ? FACE.px : 0);
  }
  return m;
}

/** The world-facing climb faces of a box (min/max corners) with vines on `worldMask` sides. */
export function boxFaces(min: readonly number[], max: readonly number[], worldMask: number): ClimbFace[] {
  const [x0, y0, z0] = min as [number, number, number], [x1, y1, z1] = max as [number, number, number];
  const out: ClimbFace[] = [];
  if (worldMask & FACE.px) out.push({ nx: 1, nz: 0, d: x1, t0: z0, t1: z1, y0, y1 });
  if (worldMask & FACE.nx) out.push({ nx: -1, nz: 0, d: -x0, t0: z0, t1: z1, y0, y1 });
  if (worldMask & FACE.pz) out.push({ nx: 0, nz: 1, d: z1, t0: x0, t1: x1, y0, y1 });
  if (worldMask & FACE.nz) out.push({ nx: 0, nz: -1, d: -z0, t0: x0, t1: x1, y0, y1 });
  return out;
}
