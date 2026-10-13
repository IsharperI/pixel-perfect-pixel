import { create } from "zustand";

/** What's happening in the current play-through (reset each time you press Play). */
type PlayState = {
  /** Bumped to restart the run from scratch */
  run: number;
  collected: string[];
  startedAt: number;
  /** Seconds taken, once finished */
  finishTime: number | null;
  won: boolean;
  newBest: boolean;

  restart: () => void;
  collect: (id: string) => void;
  /** Finished, taking `time` seconds */
  win: (time: number, newBest: boolean) => void;
};

const now = () => performance.now() / 1000;

export const usePlay = create<PlayState>((set, get) => ({
  run: 0,
  collected: [],
  startedAt: now(),
  finishTime: null,
  won: false,
  newBest: false,

  restart: () => set((s) => ({ run: s.run + 1, collected: [], startedAt: now(), finishTime: null, won: false, newBest: false })),
  collect: (id) => { if (!get().collected.includes(id)) set((s) => ({ collected: [...s.collected, id] })); },
  win: (time, newBest) => set({ won: true, newBest, finishTime: time }),
}));
