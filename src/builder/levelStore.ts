import { create } from "zustand";
import { BOUNCE_MAX, BOUNCE_MIN, BUILD_LIMIT, HEIGHT_LIMIT, PIECES, blankLevel, bounceHeight, bounds, canMove, canPaint, canPlace, newId, starterLevel, type Block, type Motion, type PieceId } from "./pieces";
import { defaultMotion, nextStopOffset, type V3 } from "./motion";
import { DEFAULT_TILT, TILT_MAX, TILT_MIN } from "./tilt";
import type { LevelData } from "./levelFile";
import { DEFAULT_RULES, type Rules } from "./rules";

export type Tool = "build" | "select" | "paint" | "erase";
export type Mode = "edit" | "play";

const HISTORY_LIMIT = 100;

type LevelState = {
  blocks: Block[];
  past: Block[][];
  future: Block[][];
  tool: Tool;
  piece: PieceId;
  rot: number; // rotation for the next block placed (quarter turns)
  selectedId: string | null;
  /** Which stop of the selected moving platform the arrows move (0 = the platform itself) */
  stopIndex: number;
  mode: Mode;

  // About the level itself
  /** Which browser save slot this level belongs to */
  levelId: string;
  name: string;
  rules: Rules;
  bestTime: number | null;
  /** Fingerprint of the level as last saved/opened, to spot unsaved changes */
  baselineSig: string;
  /** Is the Level Settings panel open? */
  panelOpen: boolean;

  setTool: (t: Tool) => void;
  setPiece: (p: PieceId) => void;
  rotate: () => void; // rotates the selected block (select tool) or the next block (build tool)
  select: (id: string | null) => void;
  place: (b: Omit<Block, "id">) => boolean;
  remove: (id: string) => void;
  /** Place several pieces as one undo step (drag to draw). Returns how many went in. */
  placeMany: (list: Omit<Block, "id">[]) => number;
  /** Remove several blocks as one undo step (drag to erase). */
  removeMany: (ids: string[]) => void;
  move: (id: string, to: { x: number; y: number; z: number }) => boolean;
  undo: () => void;
  redo: () => void;
  setMode: (m: Mode) => void;
  replaceAll: (blocks: Block[]) => void;

  // Moving platforms
  /** Turn a block into a moving platform, or back into a still one (motion undefined) */
  setMotion: (id: string, motion: Motion | undefined) => void;
  /** Change some of a moving platform's settings */
  updateMotion: (id: string, patch: Partial<Motion>) => void;
  /** Turn a block into a tilting (seesaw) platform, or back into a still one */
  setTilt: (id: string, on: boolean) => void;
  /** Set the vine-covered sides of several blocks, as one undo step (painting) */
  paintVines: (masks: Map<string, number>) => void;
  /** How high a bounce pad launches you, in blocks */
  setBounce: (id: string, height: number) => void;
  /** How far a tilting platform tips, in degrees */
  setTiltMax: (id: string, max: number) => void;
  selectStop: (i: number) => void;
  addStop: (id: string) => void;
  removeStop: (id: string, i: number) => void;
  /** Move stop `i` (1 or more) to a new offset from the platform */
  moveStop: (id: string, i: number, offset: V3) => boolean;

  setName: (name: string) => void;
  /** Change some of the rules */
  setRules: (patch: Partial<Rules>) => void;
  /** Empty the level (just a Start pad left); can be undone */
  clearLevel: () => void;
  setBestTime: (t: number | null) => void;
  setPanelOpen: (open: boolean) => void;
  /** Open a level (from a save slot or a file). `id` is its save slot, or a new one. */
  loadLevel: (level: LevelData, id?: string) => void;
  /** Start a new, nearly empty level */
  newLevel: () => void;
  /** Remember the current level as saved */
  markSaved: () => void;
};

/** A fingerprint of everything that gets saved, to tell whether there are unsaved changes. */
export function levelSig(s: Pick<LevelState, "name" | "rules" | "blocks">): string {
  return JSON.stringify([s.name, s.rules, s.blocks.map((b) => [b.piece, b.x, b.y, b.z, b.rot, b.move ?? null, b.tilt ?? null, b.vines ?? 0, b.bounce ?? 0])]);
}

/** The current level as data to save. */
export function currentLevel(): LevelData {
  const { name, rules, bestTime, blocks } = useLevel.getState();
  return { name, rules, bestTime, blocks };
}

/** Are there changes since the level was last saved or opened? */
export const useDirty = () => useLevel((s) => levelSig(s) !== s.baselineSig);

/** Most stops one moving platform can have (besides where it starts). */
export const MAX_STOPS = 8;

/** Is a stop inside the build area (it may pass through other blocks: it's only a path)? */
export function stopFits(b: Block, [dx, dy, dz]: V3): boolean {
  const { min, max } = bounds({ ...b, x: b.x + dx, y: b.y + dy, z: b.z + dz });
  return min[1] >= 0 && max[1] <= HEIGHT_LIMIT && min[0] >= -BUILD_LIMIT && max[0] <= BUILD_LIMIT && min[2] >= -BUILD_LIMIT && max[2] <= BUILD_LIMIT;
}

/** The example level asks for everything: collect the stars, then reach the flag. */
const STARTER_RULES: Rules = { ...DEFAULT_RULES, stars: true, need: "all" };

const newLevelId = () => `lvl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const useLevel = create<LevelState>((set, get) => {
  /** Apply a change to the blocks, recording the old version for undo. */
  const commit = (blocks: Block[]) =>
    set((s) => ({ blocks, past: [...s.past, s.blocks].slice(-HISTORY_LIMIT), future: [] }));

  const starter = starterLevel();
  return {
    blocks: starter,
    past: [],
    future: [],
    tool: "build",
    piece: "cube",
    rot: 0,
    selectedId: null,
    stopIndex: 0,
    mode: "edit",

    levelId: newLevelId(),
    name: "My first level",
    rules: STARTER_RULES,
    bestTime: null,
    baselineSig: levelSig({ name: "My first level", rules: STARTER_RULES, blocks: starter }),
    panelOpen: false,

    setTool: (tool) => set({ tool, selectedId: tool === "select" ? get().selectedId : null }),
    setPiece: (piece) => set({ piece, tool: "build", selectedId: null }),

    rotate: () => {
      const { tool, selectedId, blocks } = get();
      if (tool === "select" && selectedId) {
        const b = blocks.find((x) => x.id === selectedId);
        if (!b) return;
        // Try the next rotation; if it doesn't fit, try the ones after it
        for (let i = 1; i < 4; i++) {
          const turned = { ...b, rot: (b.rot + i) % 4 };
          if (canPlace(turned, blocks, b.id)) { commit(blocks.map((x) => (x.id === b.id ? turned : x))); return; }
        }
      } else {
        set((s) => ({ rot: (s.rot + 1) % 4 }));
      }
    },

    select: (selectedId) => set({ selectedId, stopIndex: 0 }),

    place: (b) => {
      const { blocks } = get();
      if (!canPlace(b, blocks)) return false;
      // Unique pieces (the Start pad) move rather than duplicate
      const kept = PIECES[b.piece].unique ? blocks.filter((x) => x.piece !== b.piece) : blocks;
      commit([...kept, { ...b, id: newId() }]);
      return true;
    },

    remove: (id) => {
      const { blocks, selectedId } = get();
      if (!blocks.some((b) => b.id === id)) return;
      commit(blocks.filter((b) => b.id !== id));
      if (selectedId === id) set({ selectedId: null });
    },

    placeMany: (list) => {
      let blocks = get().blocks;
      let n = 0;
      for (const b of list) {
        if (!canPlace(b, blocks)) continue;
        const kept = PIECES[b.piece].unique ? blocks.filter((x) => x.piece !== b.piece) : blocks;
        blocks = [...kept, { ...b, id: newId() }];
        n++;
      }
      if (n) commit(blocks);
      return n;
    },

    removeMany: (ids) => {
      const gone = new Set(ids);
      const { blocks, selectedId } = get();
      const left = blocks.filter((b) => !gone.has(b.id));
      if (left.length === blocks.length) return;
      commit(left);
      if (selectedId && gone.has(selectedId)) set({ selectedId: null });
    },

    move: (id, to) => {
      const { blocks } = get();
      const b = blocks.find((x) => x.id === id);
      if (!b) return false;
      const moved = { ...b, ...to };
      if (moved.x === b.x && moved.y === b.y && moved.z === b.z) return true;
      if (!canPlace(moved, blocks, id)) return false;
      commit(blocks.map((x) => (x.id === id ? moved : x)));
      return true;
    },

    undo: () => {
      const { past, blocks, future, selectedId } = get();
      const prev = past[past.length - 1];
      if (!prev) return;
      set({ blocks: prev, past: past.slice(0, -1), future: [blocks, ...future], selectedId: prev.some((b) => b.id === selectedId) ? selectedId : null });
    },

    redo: () => {
      const { past, blocks, future, selectedId } = get();
      const next = future[0];
      if (!next) return;
      set({ blocks: next, past: [...past, blocks], future: future.slice(1), selectedId: next.some((b) => b.id === selectedId) ? selectedId : null });
    },

    setMode: (mode) => set({ mode, selectedId: null }),

    replaceAll: (blocks) => commit(blocks),

    setMotion: (id, motion) => {
      const { blocks } = get();
      const b = blocks.find((x) => x.id === id);
      if (!b || (motion && !canMove(b.piece))) return;
      commit(blocks.map((x) => {
        if (x.id !== id) return x;
        const { move: _, tilt: _t, vines: _v, ...rest } = x; // a platform either moves or tilts (and has no vines)
        return motion ? { ...rest, move: motion } : rest;
      }));
      set({ stopIndex: motion ? 1 : 0 });
    },

    setTilt: (id, on) => {
      const { blocks } = get();
      const b = blocks.find((x) => x.id === id);
      if (!b || (on && !canMove(b.piece)) || !!b.tilt === on) return;
      commit(blocks.map((x) => {
        if (x.id !== id) return x;
        const { move: _, tilt: _t, vines: _v, ...rest } = x;
        return on ? { ...rest, tilt: { max: DEFAULT_TILT } } : rest;
      }));
      set({ stopIndex: 0 });
    },

    paintVines: (masks) => {
      const { blocks } = get();
      let changed = false;
      const next = blocks.map((b) => {
        const m = masks.get(b.id);
        if (m === undefined || (b.vines ?? 0) === m || !canPaint(b)) return b;
        changed = true;
        const { vines: _, ...rest } = b;
        return m ? { ...rest, vines: m } : rest;
      });
      if (changed) commit(next);
    },

    setBounce: (id, height) => {
      const { blocks } = get();
      const b = blocks.find((x) => x.id === id);
      const h = Math.min(BOUNCE_MAX, Math.max(BOUNCE_MIN, Math.round(height)));
      if (!b || b.piece !== "bounce" || bounceHeight(b) === h) return;
      commit(blocks.map((x) => (x.id === id ? { ...x, bounce: h } : x)));
    },

    setTiltMax: (id, max) => {
      const { blocks } = get();
      const b = blocks.find((x) => x.id === id);
      const m = Math.min(TILT_MAX, Math.max(TILT_MIN, Math.round(max)));
      if (!b?.tilt || b.tilt.max === m) return;
      commit(blocks.map((x) => (x.id === id ? { ...x, tilt: { max: m } } : x)));
    },

    updateMotion: (id, patch) => {
      const { blocks } = get();
      const b = blocks.find((x) => x.id === id);
      if (!b?.move) return;
      commit(blocks.map((x) => (x.id === id ? { ...x, move: { ...b.move!, ...patch } } : x)));
    },

    selectStop: (stopIndex) => set({ stopIndex }),

    addStop: (id) => {
      const b = get().blocks.find((x) => x.id === id);
      if (!b) return;
      if (!b.move) { get().setMotion(id, defaultMotion()); return; }
      if (b.move.stops.length >= MAX_STOPS) return;
      let off = nextStopOffset(b.move);
      if (!stopFits(b, off)) off = [b.move.stops.at(-1)![0], b.move.stops.at(-1)![1] + 2, b.move.stops.at(-1)![2]];
      get().updateMotion(id, { stops: [...b.move.stops, off] });
      set({ stopIndex: b.move.stops.length + 1 });
    },

    removeStop: (id, i) => {
      const b = get().blocks.find((x) => x.id === id);
      if (!b?.move || i < 1) return;
      const stops = b.move.stops.filter((_, k) => k !== i - 1);
      if (!stops.length) get().setMotion(id, undefined);
      else get().updateMotion(id, { stops });
      set({ stopIndex: Math.min(i, stops.length) });
    },

    moveStop: (id, i, offset) => {
      const b = get().blocks.find((x) => x.id === id);
      if (!b?.move || i < 1 || !stopFits(b, offset)) return false;
      const old = b.move.stops[i - 1];
      if (old && old[0] === offset[0] && old[1] === offset[1] && old[2] === offset[2]) return true;
      get().updateMotion(id, { stops: b.move.stops.map((s, k) => (k === i - 1 ? offset : s)) });
      return true;
    },

    setName: (name) => set({ name: name.slice(0, 40) }),
    setRules: (patch) => set((s) => {
      const rules = { ...s.rules, ...patch };
      // A best time only counts for the same challenge, so changing what wins (or the clock) clears it
      const same = rules.flag === s.rules.flag && rules.stars === s.rules.stars && rules.need === s.rules.need && rules.clock === s.rules.clock;
      return { rules, bestTime: same ? s.bestTime : null };
    }),
    clearLevel: () => {
      commit([{ id: newId(), piece: "start", x: 0, y: 0, z: 0, rot: 0 }]);
      set({ selectedId: null });
    },
    setBestTime: (bestTime) => set({ bestTime }),
    setPanelOpen: (panelOpen) => set({ panelOpen }),

    loadLevel: (level, id) => {
      set({
        ...level,
        levelId: id ?? newLevelId(),
        past: [], future: [], selectedId: null, mode: "edit",
        baselineSig: levelSig(level),
      });
    },

    newLevel: () => get().loadLevel({ name: "New level", rules: DEFAULT_RULES, bestTime: null, blocks: blankLevel() }),

    markSaved: () => set((s) => ({ baselineSig: levelSig(s) })),
  };
});
