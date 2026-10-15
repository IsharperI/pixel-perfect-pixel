import { create } from "zustand";
import type { Block } from "./pieces";
import { useLevel, type Mode } from "./levelStore";
import { listSavedLevels } from "./levelFile";

/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  LEVEL BUILDER TOUR
 *  The wording lives in TOUR below. Edit freely:
 *   - title / body / tryIt: the text on the card
 *   - glow: which buttons light up (their data-tour names)
 *   - done: when the step counts as finished, given the level now and when the
 *     step started. Leave it out for read-only steps (Next is always available).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** What a step can look at to see if you've done it. */
export type TourState = { blocks: Block[]; panelOpen: boolean; mode: Mode; levelId: string };

export type TourStep = {
  title: string;
  body: string;
  tryIt?: string;
  glow?: string[];
  done?: (now: TourState, start: TourState) => boolean;
  /** Different words for touch screens (phones and tablets) */
  touch?: { body?: string; tryIt?: string };
};

const count = (blocks: Block[], test: (b: Block) => boolean) => blocks.reduce((n, b) => n + (test(b) ? 1 : 0), 0);
const bits = (n: number) => { let c = 0; for (let v = n; v; v >>= 1) c += v & 1; return c; };

export const TOUR: TourStep[] = [
  {
    title: "Add a block",
    body: "Levels are built from blocks, like LEGO. The bar at the bottom holds every piece, sorted into groups. The Cube (in Ground) is already picked.",
    tryIt: "Click the water (or the top or side of a block) to add a cube.",
    touch: { body: "Levels are built from blocks, like LEGO. The bar at the bottom holds every piece, sorted into groups.", tryIt: "Open Ground and pick the Cube (that turns Draw on), then tap the water to add one." },
    glow: ["piece-cube", "draw"],
    done: (n, s) => n.blocks.length > s.blocks.length,
  },
  {
    title: "Fill an area",
    body: "Need a big floor? Drag instead of clicking: hold the left mouse button and drag to fill a whole rectangle at once.",
    tryIt: "Drag across the water to fill a floor.",
    touch: { body: "Need a big floor? With Draw on, drag your finger instead of tapping to fill a whole rectangle at once." },
    glow: ["piece-cube"],
    done: (n, s) => n.blocks.length >= s.blocks.length + 4,
  },
  {
    title: "Look around",
    body: "Hold the right mouse button and drag to turn the view. Drag with the middle button (the wheel) to slide it, and scroll to zoom in and out. Made a mistake? Undo is Ctrl+Z (or Undo, in Tools).",
    touch: { body: "Two fingers always pinch to zoom and drag to slide the view. To turn it with one finger, tap Draw to switch it off; tap Draw again when you want to build. Made a mistake? Undo is in Tools, in the bar at the bottom." },
    glow: ["undo"],
  },
  {
    title: "Ramps and colours",
    body: "Each colour means something: sand is solid ground, pink is a slope that changes your speed. Point at any piece in the bar to see what it does. Press R to turn a piece before you place it, or turn it afterwards with Select.",
    tryIt: "Open Interactions, pick the Ramp, and place one.",
    touch: { body: "Each colour means something: sand is solid ground, pink is a slope that changes your speed. The line above the bar says what the picked piece does. To turn one after placing it, pick Select (in Tools), tap it and press Turn.", tryIt: "Pick the Ramp in Interactions and place one." },
    glow: ["piece-ramp"],
    done: (n, s) => count(n.blocks, (b) => b.piece === "ramp" || b.piece === "steep") > count(s.blocks, (b) => b.piece === "ramp" || b.piece === "steep"),
  },
  {
    title: "Make it float",
    body: "Select (in Tools) picks a block. A card pops up to Turn, Move, Copy or Delete it, and coloured arrows appear: drag them to slide it around; the green one lifts it up so it floats.",
    tryIt: "Open Tools, pick Select, click a block, and drag its green arrow up.",
    glow: ["tool-select"],
    done: (n, s) => n.blocks.some((b) => { const was = s.blocks.find((o) => o.id === b.id); return !!was && b.y > was.y; }),
  },
  {
    title: "Moving and tilting",
    body: "With a block selected, you can make it a moving platform (orange: it travels between stops you place) or a tilting platform (purple: it tips like a seesaw when you stand on it).",
    tryIt: "Select a cube, big block or plank, then press Moving platform or Tilting platform.",
    glow: ["tool-select", "make-move", "make-tilt"],
    done: (n, s) => count(n.blocks, (b) => !!b.move || !!b.tilt) > count(s.blocks, (b) => !!b.move || !!b.tilt),
  },
  {
    title: "Climbing vines",
    body: "Vines (in Interactions) grow on the side of a block, and you can climb them. In Play, walk up to them and press E to climb.",
    tryIt: "Pick Vines and click the side of a block.",
    glow: ["tool-paint"],
    done: (n, s) => n.blocks.reduce((t, b) => t + bits(b.vines ?? 0), 0) > s.blocks.reduce((t, b) => t + bits(b.vines ?? 0), 0),
  },
  {
    title: "Bounce pads",
    body: "Cyan bounce pads spring you into the air. Select one to choose how high it sends you. Hold jump as you land for an extra-big bounce.",
    tryIt: "Place a Bounce pad (in Interactions).",
    glow: ["piece-bounce"],
    done: (n, s) => count(n.blocks, (b) => b.piece === "bounce") > count(s.blocks, (b) => b.piece === "bounce"),
  },
  {
    title: "Checkpoints and lava",
    body: "Red lava sends you back if you touch it. A blue Checkpoint flag saves your spot: once you've touched it, falling or touching lava brings you back there instead of the Start.",
    tryIt: "Place a Checkpoint (in Goals) or some Lava (in Hazards).",
    glow: ["piece-checkpoint", "piece-lava"],
    done: (n, s) => count(n.blocks, (b) => b.piece === "checkpoint" || b.piece === "lava") > count(s.blocks, (b) => b.piece === "checkpoint" || b.piece === "lava"),
  },
  {
    title: "Start, goal and collectables",
    body: "Every level has one white Start pad where you begin. In Goals, add a checkered Goal flag and some gold Collectables, then open Level settings to choose what wins: reach the flag, grab the collectables, or both, with or without a clock. Select a collectable to make it a homing attack target.",
    tryIt: "Open Level settings (the Level button, or press L).",
    touch: { tryIt: "Open Level settings (the Level button, top right)." },
    glow: ["piece-start", "piece-goal", "piece-star", "level"],
    done: (n) => n.panelOpen,
  },
  {
    title: "Play it!",
    body: "Press Play to try your level with the character you tuned in Character Modifiers. Fall in the water and you're back at the Start (or your last checkpoint). Press Esc to come back and keep building.",
    touch: { body: "Press Play to try your level with the character you tuned in Character Modifiers. Use the stick and buttons on screen. Fall in the water and you're back at the Start (or your last checkpoint). Back to building returns you here." },
    tryIt: "Press Play.",
    glow: ["play"],
    done: (n) => n.mode === "play",
  },
  {
    title: "Save it",
    body: "Save keeps your level in this browser, and Load opens your saved levels. To show a friend, press Share for a link that opens your level for them (or export it as a file in Level settings).",
    tryIt: "Press Save (top left).",
    glow: ["save"],
    done: (n) => listSavedLevels().some((l) => l.id === n.levelId),
  },
  {
    title: "You're a level builder!",
    body: "That's everything. Build something fun, then hand it to someone to play. You can take this tour again any time from the Tour button.",
    glow: ["tour"],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Tour state
// ─────────────────────────────────────────────────────────────────────────────

const SEEN_KEY = "platformer-toolkit-3d.builder-tour-seen";
const readSeen = () => { try { return window.localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; } };
const markSeen = () => { try { window.localStorage.setItem(SEEN_KEY, "1"); } catch { /* ignore */ } };

export const tourState = (): TourState => {
  const { blocks, panelOpen, mode, levelId } = useLevel.getState();
  return { blocks, panelOpen, mode, levelId };
};

type Tour = {
  status: "welcome" | "active" | "off";
  index: number;
  /** The level when the current step started */
  start: TourState;
  begin: () => void;
  skip: () => void;
  goTo: (i: number) => void;
  exit: () => void;
  /** Show the welcome offer if this browser hasn't seen the tour yet */
  offer: () => void;
};

export const useTour = create<Tour>((set) => ({
  status: "off",
  index: 0,
  start: { blocks: [], panelOpen: false, mode: "edit", levelId: "" },
  begin: () => { markSeen(); set({ status: "active", index: 0, start: tourState() }); },
  skip: () => { markSeen(); set({ status: "off" }); },
  goTo: (i) => set({ index: Math.max(0, Math.min(TOUR.length - 1, i)), start: tourState() }),
  exit: () => set({ status: "off" }),
  offer: () => { if (!readSeen()) set({ status: "welcome" }); },
}));
