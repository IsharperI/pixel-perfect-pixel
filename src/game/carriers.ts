/**
 * Moving platforms that carry the player. Each platform registers its collider
 * and, every frame (before the player moves), how far it moved. The player adds
 * that movement when standing on it, and marks it as stood on (for platforms
 * that wait until you step on them). After the player has moved, each platform
 * is placed at its new position directly (not given a velocity), so the physics
 * engine doesn't also try to carry the player and move them twice.
 */
export type Carrier = {
  dx: number; dy: number; dz: number;
  stoodOn: boolean;
  /** Put the platform at its new position (called after the player has moved this frame) */
  commit: () => void;
};

export const carriers = new Map<number, Carrier>();
