import * as THREE from "three";

/**
 * Homing attack targets: floating orbs the player can lock onto in mid-air and
 * dash to. Hitting one pops it (it comes back after a few seconds) and bounces
 * the player up, ready to chain to the next.
 */
export type Target = { id: number; pos: THREE.Vector3; activeAt: number };

const RESPAWN = 3; // seconds before a popped target comes back

// A rising staircase of targets to the right of the tall wall, ending at a high platform
export const CHAIN_X = 32;
export const TARGETS: Target[] = [
  [CHAIN_X, 3.2, 8],
  [CHAIN_X, 5.8, 2],
  [CHAIN_X, 8.4, -4],
  [CHAIN_X, 11, -10],
].map(([x, y, z], id) => ({ id, pos: new THREE.Vector3(x, y, z), activeAt: 0 }));

/** Which target the player is currently locked onto (-1 = none). Written by the player each frame. */
export const homingState = { lockedId: -1 };

export const isActive = (t: Target, now: number) => now >= t.activeAt;

export function popTarget(t: Target, now: number) {
  t.activeAt = now + RESPAWN;
}

/**
 * The best target to lock onto from `from`: the nearest active one within `range`
 * that isn't behind the player (relative to `facing`) and isn't far below.
 */
export function findLockTarget(from: { x: number; y: number; z: number }, facing: number, range: number, now: number): Target | null {
  const fx = Math.sin(facing), fz = Math.cos(facing);
  let best: Target | null = null, bestD = Infinity;
  for (const t of TARGETS) {
    if (!isActive(t, now)) continue;
    const dx = t.pos.x - from.x, dy = t.pos.y - from.y, dz = t.pos.z - from.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > range || dy < -4) continue;
    const hd = Math.hypot(dx, dz);
    if (hd > 0.5 && (dx * fx + dz * fz) / hd < -0.2) continue; // behind us
    if (d < bestD) { bestD = d; best = t; }
  }
  return best;
}
