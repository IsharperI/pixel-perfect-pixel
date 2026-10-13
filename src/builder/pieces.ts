/**
 * Building pieces for the Level Builder. Everything snaps to a grid of 1-unit
 * cells; a block's position is the grid cell of its lowest corner (min x, y, z).
 * Colour = behaviour: every block's colour tells players what it does.
 */

export type PieceId = "cube" | "wide" | "plank" | "ramp" | "steep" | "start" | "goal" | "star";
export type Behaviour = "solid" | "slope" | "start" | "goal" | "star";

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
};

export const PIECE_ORDER: PieceId[] = ["cube", "wide", "plank", "ramp", "steep", "start", "goal", "star"];

/** Colour for each behaviour (and the legend). */
export const BEHAVIOUR_COLOURS: Record<Behaviour, { colour: string; edge: string; name: string; meaning: string }> = {
  solid: { colour: "#e9cf9d", edge: "#b8955a", name: "Sand", meaning: "Solid ground" },
  slope: { colour: "#f59ac0", edge: "#c45d8a", name: "Pink", meaning: "Slope: changes your speed" },
  start: { colour: "#ffffff", edge: "#7c8a99", name: "White pad", meaning: "Where you start" },
  goal: { colour: "#ffffff", edge: "#1f2937", name: "Checkered flag", meaning: "The goal" },
  star: { colour: "#fbbf24", edge: "#b45309", name: "Gold", meaning: "Star: collect it" },
};

export type Block = { id: string; piece: PieceId; x: number; y: number; z: number; rot: number };

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

/** Where the character appears: standing on the start pad. */
export function spawnPoint(blocks: Block[]): [number, number, number] {
  const s = blocks.find((b) => b.piece === "start");
  if (!s) return [0, 2, 0];
  return [s.x + 0.5, s.y + 0.2 + 0.95 + 0.05, s.z + 0.5];
}

let counter = 0;
export const newId = () => `b${Date.now().toString(36)}${(counter++).toString(36)}`;

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
