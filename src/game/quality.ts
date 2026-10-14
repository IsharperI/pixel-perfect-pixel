import { create } from "zustand";

/**
 * Graphics quality. "high" and "low" are fixed; "auto" starts sharp and watches the
 * frame rate, lowering the sharpness (then shadows, then extras like steam) if the
 * game stutters, and raising them again when there's headroom.
 */
export type Graphics = "auto" | "high" | "low";

const KEY = "platformer-toolkit-3d.graphics";
const readGraphics = (): Graphics => {
  try { const v = window.localStorage.getItem(KEY); return v === "high" || v === "low" ? v : "auto"; } catch { return "auto"; }
};

export const isTouchDevice = () => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;
const deviceDpr = () => (typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);

/** How sharp to start: full sharpness on a computer, a little less on touch screens (they're very dense). */
export const startDpr = (g: Graphics) => (g === "low" ? 1 : Math.min(deviceDpr(), g === "auto" && isTouchDevice() ? 1.5 : 2));

type Quality = {
  graphics: Graphics;
  /** Render sharpness (pixels per CSS pixel) */
  dpr: number;
  /** Soft shadows from the sun (the dark spot under the character stays either way) */
  shadows: boolean;
  /** Little extras: lava steam, full dust puffs */
  extras: boolean;
  /** Auto mode has turned things down to keep it smooth */
  lowered: boolean;
  setGraphics: (g: Graphics) => void;
  /** Auto mode: one step down (sharpness, then shadows, then extras) */
  stepDown: () => void;
  /** Auto mode: one step back up */
  stepUp: () => void;
};

const preset = (g: Graphics) => ({ dpr: startDpr(g), shadows: g !== "low", extras: g !== "low", lowered: false });

export const useQuality = create<Quality>((set, get) => ({
  graphics: "auto",
  ...preset("auto"),
  setGraphics: (graphics) => {
    try { window.localStorage.setItem(KEY, graphics); } catch { /* ignore */ }
    set({ graphics, ...preset(graphics) });
  },
  stepDown: () => {
    const q = get();
    if (q.graphics !== "auto") return;
    if (q.dpr > 1) set({ dpr: Math.max(1, Math.round((q.dpr - 0.25) * 4) / 4), lowered: true });
    else if (q.shadows) set({ shadows: false, lowered: true });
    else if (q.extras) set({ extras: false, lowered: true });
  },
  stepUp: () => {
    const q = get();
    if (q.graphics !== "auto") return;
    const top = startDpr("auto");
    if (!q.extras) set({ extras: true });
    else if (!q.shadows) set({ shadows: true });
    else if (q.dpr < top) set({ dpr: Math.min(top, q.dpr + 0.25) });
    const n = get();
    if (n.extras && n.shadows && n.dpr >= top) set({ lowered: false });
  },
}));

/** Load the saved choice (call once in the browser). */
export function loadGraphics() {
  const g = readGraphics();
  if (g !== useQuality.getState().graphics || useQuality.getState().dpr !== startDpr(g)) useQuality.setState({ graphics: g, ...preset(g) });
}
