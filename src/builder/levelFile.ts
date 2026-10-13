/**
 * Level files and browser save slots. A level file is plain JSON, tagged so it
 * can't be confused with a character file:
 *   { format: "platformer-toolkit-3d/level", version: 1, name, goal, bestTime, blocks: [...] }
 */
import { PIECES, canPlace, newId, type Block, type PieceId } from "./pieces";

export const LEVEL_FORMAT = "platformer-toolkit-3d/level";
export const LEVEL_VERSION = 1;

/** What finishing the level means. */
export type Goal = "flag" | "stars" | "time" | "none";
export const GOALS: Goal[] = ["flag", "stars", "time", "none"];

export type LevelData = {
  name: string;
  goal: Goal;
  /** Fastest Time Trial finish in seconds, or null if never finished */
  bestTime: number | null;
  blocks: Block[];
};

/** Most blocks a level file may hold (keeps a bad file from freezing the page). */
export const MAX_BLOCKS = 5000;

export function toLevelFile(level: LevelData) {
  return {
    format: LEVEL_FORMAT,
    version: LEVEL_VERSION,
    name: level.name,
    goal: level.goal,
    bestTime: level.bestTime,
    savedAt: new Date().toISOString(),
    blocks: level.blocks.map(({ piece, x, y, z, rot }) => ({ piece, x, y, z, rot })),
  };
}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

/**
 * Read a parsed level file. Unknown pieces, broken entries and blocks that
 * overlap are dropped. Returns null if it isn't a level file at all.
 */
export function readLevelFile(data: unknown): LevelData | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const o = data as Record<string, unknown>;
  if (o["format"] !== LEVEL_FORMAT || !Array.isArray(o["blocks"])) return null;

  const blocks: Block[] = [];
  for (const raw of (o["blocks"] as unknown[]).slice(0, MAX_BLOCKS)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const piece = r["piece"];
    if (typeof piece !== "string" || !(piece in PIECES)) continue;
    const { x, y, z } = r;
    const rot = r["rot"] ?? 0;
    if (!isInt(x) || !isInt(y) || !isInt(z) || !isInt(rot)) continue;
    const b = { piece: piece as PieceId, x, y, z, rot: ((rot % 4) + 4) % 4 };
    if (PIECES[b.piece].unique && blocks.some((k) => k.piece === b.piece)) continue;
    if (!canPlace(b, blocks)) continue;
    blocks.push({ ...b, id: newId() });
  }

  const name = typeof o["name"] === "string" && o["name"].trim() ? o["name"].trim().slice(0, 40) : "My level";
  const goal = GOALS.includes(o["goal"] as Goal) ? (o["goal"] as Goal) : "flag";
  const bt = o["bestTime"];
  const bestTime = typeof bt === "number" && Number.isFinite(bt) && bt > 0 ? bt : null;
  return { name, goal, bestTime, blocks };
}

/** A safe file name for downloading a level. */
export function levelFileName(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "level";
  return `${slug}.level.json`;
}

// ---- Browser save slots ------------------------------------------------------

const SLOTS_KEY = "platformer-toolkit-3d.saved-levels";

export type SavedLevel = { id: string; name: string; savedAt: string; file: ReturnType<typeof toLevelFile> };

/** Every level saved in this browser, newest first. Empty if storage can't be read. */
export function listSavedLevels(): SavedLevel[] {
  try {
    const raw = window.localStorage.getItem(SLOTS_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    return (list as SavedLevel[])
      .filter((s) => s && typeof s.id === "string" && s.file && typeof s.file === "object")
      .sort((a, b) => (b.savedAt ?? "").localeCompare(a.savedAt ?? ""));
  } catch {
    return [];
  }
}

function writeSlots(list: SavedLevel[]): boolean {
  try {
    window.localStorage.setItem(SLOTS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** Save (or overwrite) the level stored under `id`. Returns false if the browser won't store it. */
export function saveLevelToBrowser(id: string, level: LevelData): boolean {
  const file = toLevelFile(level);
  const list = listSavedLevels().filter((s) => s.id !== id);
  return writeSlots([{ id, name: level.name, savedAt: file.savedAt, file }, ...list]);
}

export function deleteSavedLevel(id: string): boolean {
  return writeSlots(listSavedLevels().filter((s) => s.id !== id));
}

/** Update just the best time of a saved level (so a record sticks without a full save). */
export function saveBestTime(id: string, bestTime: number | null) {
  const list = listSavedLevels();
  const slot = list.find((s) => s.id === id);
  if (!slot) return;
  slot.file = { ...slot.file, bestTime };
  writeSlots(list);
}
