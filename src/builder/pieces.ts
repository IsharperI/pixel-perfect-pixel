/**
 * Building pieces for the Level Builder. Everything snaps to a grid of 1-unit
 * cells; a block's position is the grid cell of its lowest corner (min x, y, z).
 * Colour = behaviour: every block's colour tells players what it does.
 */

export type PieceId = "cube" | "wide" | "plank" | "ramp" | "steep" | "start" | "goal" | "star" | "bounce" | "checkpoint" | "lava";
export type Behaviour = "solid" | "slope" | "start" | "goal" | "star" | "moving" | "tilting" | "vines" | "bounce" | "checkpoint" | "danger";

export type Piece = {
  label: string;
  /** Size before rotation: [width (x), height (y), length (z)] in cells */
  size: [number, number, number];
  behaviour: Behaviour;
  /** Ramps rise toward +z before rotation */
  ramp?: boolean;
  /** Only one of these can exist in a level (placing another moves it) */
  unique?: boolean;
};

export const PIECES: Record<PieceId, Piece> = {
  cube: { label: "Cube", size: [1, 1, 1], behaviour: "solid" },
  wide: { label: "Big block", size: [2, 1, 2], behaviour: "solid" },
  plank: { label: "Plank", size: [3, 1, 1], behaviour: "solid" },
  ramp: { label: "Ramp", size: [1, 1, 2], behaviour: "slope", ramp: true },
  steep: { label: "Steep ramp", size: [1, 1, 1], behaviour: "slope", ramp: true },
  start: { label: "Start", size: [1, 1, 1], behaviour: "start", unique: true },
  goal: { label: "Goal flag", size: [1, 1, 1], behaviour: "goal", unique: true },
  star: { label: "Star", size: [1, 1, 1], behaviour: "star" },
  bounce: { label: "Bounce pad", size: [1, 1, 1], behaviour: "bounce" },
  checkpoint: { label: "Checkpoint", size: [1, 1, 1], behaviour: "checkpoint" },
  lava: { label: "Lava", size: [1, 1, 1], behaviour: "danger" },
};

export const PIECE_ORDER: PieceId[] = ["cube", "wide", "plank", "ramp", "steep", "bounce", "lava", "start", "checkpoint", "goal", "star"];

/** Colour for each behaviour (and the legend). */
export const BEHAVIOUR_COLOURS: Record<Behaviour, { colour: string; edge: string; name: string; meaning: string }> = {
  solid: { colour: "#e9cf9d", edge: "#b8955a", name: "Sand", meaning: "Solid ground" },
  slope: { colour: "#f59ac0", edge: "#c45d8a", name: "Pink", meaning: "Slope: changes your speed" },
  start: { colour: "#ffffff", edge: "#7c8a99", name: "White pad", meaning: "Where you start" },
  goal: { colour: "#ffffff", edge: "#1f2937", name: "Checkered flag", meaning: "The goal" },
  star: { colour: "#fbbf24", edge: "#b45309", name: "Gold", meaning: "Star: collect it" },
  moving: { colour: "#fb923c", edge: "#c2410c", name: "Orange", meaning: "Moving platform" },
  tilting: { colour: "#b794f6", edge: "#6d28d9", name: "Purple", meaning: "Tilts when you stand on it" },
  vines: { colour: "#4ade80", edge: "#15803d", name: "Vine green", meaning: "Vines: grab (E) and climb" },
  bounce: { colour: "#22d3ee", edge: "#0e7490", name: "Cyan", meaning: "Bounce pad: springs you up" },
  checkpoint: { colour: "#60a5fa", edge: "#1d4ed8", name: "Blue flag", meaning: "Checkpoint: come back here" },
  danger: { colour: "#ef4444", edge: "#991b1b", name: "Red", meaning: "Lava: ouch! back to checkpoint" },
};

/** How a moving platform moves. Stop 1 is the block itself; `stops` are the rest, as offsets from it. */
export type Motion = {
  stops: [number, number, number][];
  /** Blocks per second */
  speed: number;
  /** Seconds to pause at each stop */
  wait: number;
  /** "always" = moving from the start; "step" = waits until you stand on it */
  trigger: "always" | "step";
  /** true = after the last stop go straight back to the first; false = back and forth */
  loop: boolean;
};

export type Block = {
  id: string; piece: PieceId; x: number; y: number; z: number; rot: number;
  /** A moving platform */
  move?: Motion;
  /** A seesaw platform that tips toward where you stand (pivot in the middle), up to `max` degrees */
  tilt?: { max: number };
  /** Sides covered in climbable vines: bit flags in the block's own frame (see game/climb.ts FACE) */
  vines?: number;
  /** Bounce pads: how high they launch you, in blocks */
  bounce?: number;
};

/** Can vines be painted on this block? (Still, plain blocks: not ramps, moving or tilting ones.) */
export const canPaint = (b: Pick<Block, "piece" | "move" | "tilt">) => PIECES[b.piece].behaviour === "solid" && !b.move && !b.tilt;

/** Can this piece be made into a moving or tilting platform? (Plain solid blocks only, for now.) */
export const canMove = (piece: PieceId) => PIECES[piece].behaviour === "solid";

/** Behaviour colour for a block (moving blocks are orange, tilting ones purple). */
export const behaviourOf = (b: Pick<Block, "piece" | "move" | "tilt">): Behaviour =>
  b.move ? "moving" : b.tilt ? "tilting" : PIECES[b.piece].behaviour;

/** Footprint after rotation: [x size, height, z size]. Rotation is in quarter turns around the vertical. */
export function footprint(piece: PieceId, rot: number): [number, number, number] {
  const [w, h, l] = PIECES[piece].size;
  return rot % 2 === 0 ? [w, h, l] : [l, h, w];
}

/** The box of grid cells a block fills: min corner inclusive, max corner exclusive. */
export function bounds(b: Pick<Block, "piece" | "x" | "y" | "z" | "rot">) {
  const [fx, h, fz] = footprint(b.piece, b.rot);
  return { min: [b.x, b.y, b.z] as const, max: [b.x + fx, b.y + h, b.z + fz] as const };
}

/** World-space centre of a block (where its mesh sits). */
export function centre(b: Pick<Block, "piece" | "x" | "y" | "z" | "rot">): [number, number, number] {
  const [fx, h, fz] = footprint(b.piece, b.rot);
  return [b.x + fx / 2, b.y + h / 2, b.z + fz / 2];
}

/** Do two blocks fill any of the same cells? */
export function overlaps(a: Pick<Block, "piece" | "x" | "y" | "z" | "rot">, b: Pick<Block, "piece" | "x" | "y" | "z" | "rot">) {
  const A = bounds(a), B = bounds(b);
  for (let i = 0; i < 3; i++) if (A.max[i]! <= B.min[i]! || B.max[i]! <= A.min[i]!) return false;
  return true;
}

/** The build area: how far from the middle you can build, and how high. */
export const BUILD_LIMIT = 30;
export const HEIGHT_LIMIT = 30;

/** Is this spot allowed: inside the build area, above ground, and not overlapping anything (except `ignoreId`)? */
export function canPlace(candidate: Omit<Block, "id">, blocks: Block[], ignoreId?: string): boolean {
  const { min, max } = bounds(candidate);
  if (min[1] < 0 || max[1] > HEIGHT_LIMIT) return false;
  if (min[0] < -BUILD_LIMIT || max[0] > BUILD_LIMIT || min[2] < -BUILD_LIMIT || max[2] > BUILD_LIMIT) return false;
  return !blocks.some((b) => b.id !== ignoreId && overlaps(candidate, b) && !(PIECES[candidate.piece].unique && b.piece === candidate.piece));
}

/** Where the character stands on a pad piece (start or checkpoint) at cell (x, y, z). */
export const standOnPad = (b: Pick<Block, "x" | "y" | "z">): [number, number, number] => [b.x + 0.5, b.y + 0.2 + 0.95 + 0.05, b.z + 0.5];

/** Where the character appears: standing on the start pad. */
export function spawnPoint(blocks: Block[]): [number, number, number] {
  const s = blocks.find((b) => b.piece === "start");
  if (!s) return [0, 2, 0];
  return [s.x + 0.5, s.y + 0.2 + 0.95 + 0.05, s.z + 0.5];
}

let counter = 0;
export const newId = () => `b${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Bounce pads: how high they launch you (in blocks): the default, and the slider's range. */
export const BOUNCE_DEFAULT = 4, BOUNCE_MIN = 2, BOUNCE_MAX = 12;
/** How high a bounce pad launches you. */
export const bounceHeight = (b: Pick<Block, "bounce">) => b.bounce ?? BOUNCE_DEFAULT;

/** A small example level so the builder never opens empty. */
export function starterLevel(): Block[] {
  const b = (piece: PieceId, x: number, y: number, z: number, rot = 0): Block => ({ id: newId(), piece, x, y, z, rot });
  return [
    // 4 x 4 floor
    b("wide", -2, 0, -2), b("wide", 0, 0, -2), b("wide", -2, 0, 0), b("wide", 0, 0, 0),
    b("start", -2, 1, 1),
    // A ramp up to a floating platform
    b("ramp", 1, 1, -2, 2),
    b("wide", 0, 1, -4), b("wide", 0, 1, -6),
    // A few stepping cubes up to the goal
    b("cube", -2, 2, -6), b("cube", -4, 3, -6), b("plank", -7, 4, -6),
    b("goal", -7, 5, -6),
    // Stars to collect
    b("star", 1, 1, 1), b("star", 1, 2, -5), b("star", -4, 4, -6),
  ];
}

/** A fresh, nearly empty level: a small floor with the Start pad. */
export function blankLevel(): Block[] {
  const b = (piece: PieceId, x: number, y: number, z: number): Block => ({ id: newId(), piece, x, y, z, rot: 0 });
  return [b("wide", -2, 0, -2), b("wide", 0, 0, -2), b("wide", -2, 0, 0), b("wide", 0, 0, 0), b("start", -1, 1, -1)];
}
