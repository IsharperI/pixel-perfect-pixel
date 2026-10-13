/**
 * Drag-to-draw and drag-to-erase: work out which pieces a dragged rectangle
 * covers. Kept free of React/three so it can be tested on its own.
 */
import { PIECES, bounds, canPlace, footprint, type Block } from "./pieces";

/** The most pieces one drag can place (keeps the preview quick). */
export const MAX_DRAW = 400;

/**
 * Pieces to place when dragging from `start` (the first piece, as the ghost showed it)
 * to the point (px, pz) on the same level. Pieces are tiled by their own size, so a
 * row of planks lies end to end. Spots that are taken or outside the build area are skipped.
 */
export function fillRect(start: Omit<Block, "id">, px: number, pz: number, blocks: Block[]): Omit<Block, "id">[] {
  if (PIECES[start.piece].unique) return canPlace(start, blocks) ? [start] : [];
  const [fx, , fz] = footprint(start.piece, start.rot);
  const steps = (from: number, to: number, size: number): [number, number] => {
    const n = Math.floor((to - from) / size);
    return n >= 0 ? [0, n] : [n, 0];
  };
  let [ix0, ix1] = steps(start.x, px, fx);
  let [iz0, iz1] = steps(start.z, pz, fz);
  // Keep the rectangle a sensible size (shrinks toward the starting corner)
  const cap = Math.floor(Math.sqrt(MAX_DRAW));
  if (ix1 - ix0 >= cap) { if (ix0 < 0) ix0 = -(cap - 1); else ix1 = cap - 1; }
  if (iz1 - iz0 >= cap) { if (iz0 < 0) iz0 = -(cap - 1); else iz1 = cap - 1; }

  const out: Omit<Block, "id">[] = [];
  for (let i = ix0; i <= ix1; i++) {
    for (let k = iz0; k <= iz1; k++) {
      const c = { ...start, x: start.x + i * fx, z: start.z + k * fz };
      if (canPlace(c, blocks)) out.push(c);
    }
  }
  return out;
}

/** The grid cells (inclusive) between two points, as a rectangle. */
export function cellRect(ax: number, az: number, bx: number, bz: number) {
  const x0 = Math.floor(Math.min(ax, bx)), x1 = Math.floor(Math.max(ax, bx));
  const z0 = Math.floor(Math.min(az, bz)), z1 = Math.floor(Math.max(az, bz));
  return { x0, x1, z0, z1 };
}

/** Blocks on layer `y` that touch the cell rectangle (inclusive). */
export function blocksInRect(rect: ReturnType<typeof cellRect>, y: number, blocks: Block[]): Block[] {
  return blocks.filter((b) => {
    const { min, max } = bounds(b);
    if (y < min[1] || y >= max[1]) return false;
    return min[0] <= rect.x1 && max[0] > rect.x0 && min[2] <= rect.z1 && max[2] > rect.z0;
  });
}
