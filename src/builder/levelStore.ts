import { create } from "zustand";
import { PIECES, canPlace, newId, starterLevel, type Block, type PieceId } from "./pieces";

export type Tool = "build" | "select" | "erase";
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
  mode: Mode;

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
};

export const useLevel = create<LevelState>((set, get) => {
  /** Apply a change to the blocks, recording the old version for undo. */
  const commit = (blocks: Block[]) =>
    set((s) => ({ blocks, past: [...s.past, s.blocks].slice(-HISTORY_LIMIT), future: [] }));

  return {
    blocks: starterLevel(),
    past: [],
    future: [],
    tool: "build",
    piece: "cube",
    rot: 0,
    selectedId: null,
    mode: "edit",

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

    select: (selectedId) => set({ selectedId }),

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
  };
});
