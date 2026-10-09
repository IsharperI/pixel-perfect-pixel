import * as THREE from "three";

/**
 * Objects that can fade out when they block the camera's view of the player.
 * Level blocks register here (keyed by an id stored in their rigid body's
 * userData); the camera code marks which ones are in the way each frame and
 * eases their opacity toward the target.
 */
export type FadeTarget = { material: THREE.MeshStandardMaterial; opacity: number };

export const fadeTargets = new Map<string, FadeTarget>();

export function registerFade(id: string, material: THREE.MeshStandardMaterial) {
  fadeTargets.set(id, { material, opacity: 1 });
  return () => {
    fadeTargets.delete(id);
  };
}

/** Ease every registered object toward its target opacity. */
export function updateFades(blocked: Set<string>, fadedOpacity: number, dt: number) {
  const k = 1 - Math.exp(-12 * dt); // ~0.25s to settle, so grazing an edge doesn't flicker
  for (const [id, t] of fadeTargets) {
    const want = blocked.has(id) ? fadedOpacity : 1;
    t.opacity += (want - t.opacity) * k;
    if (Math.abs(want - t.opacity) < 0.002) t.opacity = want;
    const m = t.material;
    const transparent = t.opacity < 0.999;
    if (m.transparent !== transparent) {
      m.transparent = transparent;
      m.needsUpdate = true;
    }
    m.opacity = t.opacity;
  }
}
