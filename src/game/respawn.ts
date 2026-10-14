/**
 * Where the player comes back after falling or touching a hazard. Levels set
 * `point` when you reach a checkpoint (null = the normal start), and set
 * `requested` to send the player back right away (e.g. touching lava).
 */
export const respawn = {
  point: null as [number, number, number] | null,
  requested: false,
};
