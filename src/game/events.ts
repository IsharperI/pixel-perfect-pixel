/**
 * Running counts of things the player has done. The player code bumps these;
 * the tutorial snapshots them when a step starts and checks what changed, so
 * a step can say "done!" when you actually try the thing it asks for.
 */
export const events = {
  distance: 0, // units travelled on the ground
  jumps: 0, // ground jumps (including long jumps)
  shortHops: 0, // normal jumps that peaked under ~60% of Jump Height (jump released early)
  fullJumps: 0, // normal jumps that reached ~85%+ of Jump Height
  coyoteJumps: 0, // jumps made just after walking off a ledge
  bufferedJumps: 0, // jumps where jump was pressed before landing
  airJumps: 0,
  longJumps: 0,
  pounds: 0,
  wallJumps: 0,
  flaps: 0,
  presetLoads: 0,
};

export type Events = typeof events;

export const snapshotEvents = (): Events => ({ ...events });
