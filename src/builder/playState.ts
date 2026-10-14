import { create } from "zustand";
import { respawn } from "../game/respawn";

/** What's happening in the current play-through (reset each time you press Play). */
type PlayState = {
  /** Bumped to restart the run from scratch */
  run: number;
  collected: string[];
  startedAt: number;
  /** Seconds taken, once finished */
  finishTime: number | null;
  won: boolean;
  /** The countdown ran out */
  lost: boolean;
  newBest: boolean;
  /** The last checkpoint reached (its block id), if any */
  checkpoint: string | null;
  /** A short message shown for a moment, like "Collect all the stars first!" */
  hint: { text: string; at: number } | null;

  restart: () => void;
  collect: (id: string) => void;
  /** Finished, taking `time` seconds */
  win: (time: number, newBest: boolean) => void;
  lose: () => void;
  showHint: (text: string) => void;
  reachCheckpoint: (id: string, at: [number, number, number]) => void;
};

const now = () => performance.now() / 1000;

export const usePlay = create<PlayState>((set, get) => ({
  run: 0,
  collected: [],
  startedAt: now(),
  finishTime: null,
  won: false,
  lost: false,
  newBest: false,
  hint: null,
  checkpoint: null,

  restart: () => {
    respawn.point = null;
    respawn.requested = false;
    set((s) => ({ run: s.run + 1, collected: [], startedAt: now(), finishTime: null, won: false, lost: false, newBest: false, hint: null, checkpoint: null }));
  },
  collect: (id) => { if (!get().collected.includes(id)) set((s) => ({ collected: [...s.collected, id] })); },
  win: (time, newBest) => set({ won: true, newBest, finishTime: time }),
  lose: () => set({ lost: true }),
  reachCheckpoint: (id, at) => {
    respawn.point = at;
    set({ checkpoint: id });
  },
  showHint: (text) => { const h = get().hint; if (!h || h.text !== text || now() - h.at > 2) set({ hint: { text, at: now() } }); },
}));
