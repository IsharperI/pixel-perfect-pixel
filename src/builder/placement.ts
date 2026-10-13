import { footprint, type Block, type PieceId } from "./pieces";

type V3 = { x: number; y: number; z: number };

/**
 * Where a new block goes when the pointer is over `hit` (a block, or null for the
 * ground) at world point `p` with surface normal `n`. LEGO-style:
 *  - ground or a top face: sits on it, centred under the pointer
 *  - a side face: attaches beside it, at that layer, extending away from the face
 *  - a bottom face: hangs underneath
 */
export function placementFor(hit: Block | null, p: V3, n: V3, piece: PieceId, rot: number): { x: number; y: number; z: number } {
  const [fx, h, fz] = footprint(piece, rot);
  const centreShift = (f: number) => Math.floor((f - 1) / 2); // so wider pieces centre on the pointer
  const cellX = Math.floor(p.x + n.x * 0.01), cellZ = Math.floor(p.z + n.z * 0.01);

  if (!hit) return { x: cellX - centreShift(fx), y: 0, z: cellZ - centreShift(fz) };

  const [, hh] = footprint(hit.piece, hit.rot);
  if (n.y > 0.5) {
    // Top (including the sloped face of a ramp): sit on top of the block
    return { x: Math.floor(p.x) - centreShift(fx), y: hit.y + hh, z: Math.floor(p.z) - centreShift(fz) };
  }
  if (n.y < -0.5) {
    // Underneath
    return { x: Math.floor(p.x) - centreShift(fx), y: hit.y - h, z: Math.floor(p.z) - centreShift(fz) };
  }
  // A side: step one cell out along the face's direction, on the layer that was pointed at
  const layer = Math.min(Math.max(Math.floor(p.y), hit.y), hit.y + hh - 1);
  const sx = Math.round(n.x), sz = Math.round(n.z);
  let x = Math.floor(p.x + sx * 0.5), z = Math.floor(p.z + sz * 0.5);
  // Extend away from the face, and centre along it
  if (sx < 0) x -= fx - 1; else if (sx === 0) x -= centreShift(fx);
  if (sz < 0) z -= fz - 1; else if (sz === 0) z -= centreShift(fz);
  return { x, y: layer, z };
}
