import { create } from "zustand";
import { events, snapshotEvents, type Events } from "./events";
import { PRESETS, presetValues, useSettings, useUI, num, bool, type SettingValues } from "./settings";

/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  TUTORIAL CONTENT
 *  All of the tutorial's wording lives in STEPS below. Edit freely:
 *   - title / body / tryIt: the text shown on the card
 *   - chapter: the small label above the title
 *   - setup: settings applied when the step starts (anything not listed keeps its value)
 *   - highlight: setting keys to highlight in the panel (the first one is scrolled to)
 *   - done: when the step counts as finished. It gets the event counts since the
 *     step started (`e`), the current settings (`v`) and the settings when the
 *     step started (`v0`). Leave it out for read-only steps (Next is always available).
 *  Directions assume the starting camera view: the gap ladder is on the LEFT,
 *  the height ladder on the RIGHT, the tall wall further right, and the slope
 *  and narrow ledge far left.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type Step = {
  chapter: string;
  title: string;
  body: string;
  tryIt?: string;
  setup?: SettingValues;
  highlight?: string[];
  done?: (e: Events, v: SettingValues, v0: SettingValues) => boolean;
};

export const STEPS: Step[] = [
  {
    chapter: "Welcome",
    title: "Get moving",
    body: "This is a playground for how platformer characters feel. Every number behind the movement is a slider you can change while you play. First, just get comfortable.",
    tryIt: "Run around with WASD. Drag the mouse to look around.",
    done: (e) => e.distance >= 15,
  },
  {
    chapter: "Running",
    title: "Acceleration",
    body: "We've turned Acceleration and Deceleration right down. Notice how the character slowly winds up and slides when you let go, like running on ice. Some games want that weight; most want snappier control.",
    tryIt: "Run and stop a few times, then drag Acceleration up until starting feels responsive.",
    setup: { acceleration: 6, deceleration: 6 },
    highlight: ["acceleration", "deceleration"],
    done: (_e, v) => num(v, "acceleration") >= 25,
  },
  {
    chapter: "Running",
    title: "Stopping",
    body: "Deceleration is how quickly you stop once you let go. Low values feel slippery; high values feel precise. Mario 64 sits in the middle, so Mario skids a little.",
    tryIt: "Raise Deceleration, then run and let go. Find a stop you like.",
    setup: { acceleration: 40, deceleration: 6 },
    highlight: ["deceleration"],
    done: (_e, v) => num(v, "deceleration") >= 25,
  },
  {
    chapter: "Jumping",
    title: "Height and hang time",
    body: "A jump is shaped by two numbers: how high it goes (Jump Height) and how long it takes to get there (Time to Apex). The same height can feel heavy and quick, or slow and dreamy.",
    tryIt: "Jump a few times. Try a Time to Apex of 0.8, then 0.25.",
    setup: { acceleration: 40, deceleration: 50, jumpHeight: 3, timeToApex: 0.4 },
    highlight: ["jumpHeight", "timeToApex"],
    done: (e) => e.jumps >= 3,
  },
  {
    chapter: "Jumping",
    title: "Falling faster",
    body: "Real jumps rise and fall at the same speed, which feels floaty in a game. Most platformers pull you down harder on the way down. We've set Fall Gravity Multiplier to 1, the 'realistic' value.",
    tryIt: "Jump and notice the floaty fall. Then raise Fall Gravity Multiplier to around 2 and jump again.",
    setup: { fallGravityMultiplier: 1 },
    highlight: ["fallGravityMultiplier"],
    done: (_e, v) => num(v, "fallGravityMultiplier") >= 1.6,
  },
  {
    chapter: "Jumping",
    title: "Tap or hold",
    body: "With Variable Jump Height on, letting go of Space early cuts the jump short. That one rule gives players fine control: little hops over small gaps, full jumps for big ones.",
    tryIt: "Do a tiny hop (tap Space) and a full jump (hold Space).",
    setup: { fallGravityMultiplier: 1.8, variableJumpHeight: true },
    highlight: ["variableJumpHeight"],
    done: (e) => e.shortHops >= 1 && e.fullJumps >= 1,
  },
  {
    chapter: "Jumping",
    title: "Steering in the air",
    body: "Air Control decides how much you can change direction mid-jump. At 0 you're committed the moment you leave the ground. That's how many classic games felt, and why their jumps were tense.",
    tryIt: "Jump and try to steer. Then raise Air Control and feel the difference.",
    setup: { airControl: 0 },
    highlight: ["airControl"],
    done: (_e, v) => num(v, "airControl") >= 0.4,
  },
  {
    chapter: "Forgiveness",
    title: "Coyote time",
    body: "Players often press jump a moment too late, just after running off an edge. Coyote Time quietly lets that jump happen anyway. It's named after the cartoon coyote who hangs in the air before he notices he's run off the cliff.",
    tryIt: "Find the long pink Narrow Ledge (far left, up the slope). Run off the end and press jump just after you leave it.",
    setup: { airControl: 0.6, coyoteTime: 0.15 },
    highlight: ["coyoteTime"],
    done: (e) => e.coyoteJumps >= 1,
  },
  {
    chapter: "Forgiveness",
    title: "Jump buffer",
    body: "The opposite mistake: pressing jump just before you land. Jump Buffer remembers the press for a moment, so the jump happens the instant you touch down. Without it, bunny-hopping feels unresponsive.",
    tryIt: "Keep jumping, pressing Space again just before you land each time.",
    setup: { coyoteTime: 0.1, jumpBuffer: 0.15 },
    highlight: ["jumpBuffer"],
    done: (e) => e.bufferedJumps >= 2,
  },
  {
    chapter: "Forgiveness",
    title: "Compare with the ghost",
    body: "The dotted trail shows your last jump's arc, and the faded purple ghost shows the one before it. Use them to see exactly what a change does.",
    tryIt: "Jump on the coloured platforms on the left. Change Jump Height, then jump again and compare the two arcs.",
    setup: { jumpBuffer: 0.1 },
    highlight: ["jumpHeight"],
    done: (e, v, v0) => e.jumps >= 2 && v["jumpHeight"] !== v0["jumpHeight"],
  },
  {
    chapter: "Camera",
    title: "The leash",
    body: "The camera follows as if it's tied to you with a rope. Turning or running sideways pulls it around; running toward it just pushes it back. Follow Smoothing decides how lazily it catches up.",
    tryIt: "Run in circles. Then try Leash Swing at 0 and notice the camera stops following your turns.",
    highlight: ["leashSwing", "followSmoothing"],
    done: (_e, v, v0) => v["leashSwing"] !== v0["leashSwing"] || v["followSmoothing"] !== v0["followSmoothing"],
  },
  {
    chapter: "Camera",
    title: "Walls in the way",
    body: "When something blocks the view, the camera can fade it out, push in closer (like Mario 64), or ignore it. The silhouette shows where you are if you're hidden.",
    tryIt: "Walk behind the Tall Wall on the right. Switch Obstruction between Fade and Push In.",
    setup: { cameraObstruction: "fade", playerSilhouette: true },
    highlight: ["cameraObstruction", "fadeOpacity", "playerSilhouette"],
    done: (_e, v, v0) => v["cameraObstruction"] !== v0["cameraObstruction"],
  },
  {
    chapter: "Juice",
    title: "Game feel",
    body: "'Juice' is everything that isn't the movement itself: squash and stretch, dust, a camera bump, sound. We've switched it all off. The jump is identical, but notice how lifeless it feels.",
    tryIt: "Jump off the tallest block on the height ladder (right). Then turn Squash & Stretch, Dust Puffs and Landing Bump back on and jump again.",
    setup: { squashStretch: 0, dust: false, landingBump: 0 },
    highlight: ["squashStretch", "dust", "landingBump", "sounds"],
    done: (_e, v) => num(v, "squashStretch") >= 0.2 && bool(v, "dust") && num(v, "landingBump") >= 0.1,
  },
  {
    chapter: "Moves",
    title: "Double jump",
    body: "Special moves give players more ways to solve the same space. We've switched on Double Jump: press jump again in mid-air, and you can change direction as you do.",
    tryIt: "Do a double jump. Try setting Air Jumps to 2 for a triple.",
    setup: { squashStretch: 0.5, dust: true, landingBump: 0.35, doubleJump: true },
    highlight: ["doubleJump", "airJumps"],
    done: (e) => e.airJumps >= 1,
  },
  {
    chapter: "Moves",
    title: "Long jump and ground pound",
    body: "Both use Shift. While running, hold Shift and jump for a long, low leap. In mid-air, press Shift to flip, hang for a moment, then slam down.",
    tryIt: "Do one long jump and one ground pound.",
    setup: { doubleJump: false, longJump: true, groundPound: true },
    highlight: ["longJump", "groundPound"],
    done: (e) => e.longJumps >= 1 && e.pounds >= 1,
  },
  {
    chapter: "Moves",
    title: "Wall jump",
    body: "Jump into a wall, then press jump again the moment you hit it to kick off the other way. Wall Jump Window sets how strict the timing is. Mario 64's was famously tight.",
    tryIt: "Wall jump off the Tall Wall on the right.",
    setup: { longJump: false, groundPound: false, wallJump: true, wallJumpWindow: 0.25 },
    highlight: ["wallJump", "wallJumpWindow"],
    done: (e) => e.wallJumps >= 1,
  },
  {
    chapter: "Moves",
    title: "Float",
    body: "A completely different answer to 'what happens in the air'. Each press of jump is a little flap, and you drift down slowly in between. Press Shift to exhale and drop.",
    tryIt: "Jump, then flap your way up with a few presses of Space.",
    setup: { wallJump: false, float: true },
    highlight: ["float", "floatFlaps", "flapLift"],
    done: (e) => e.flaps >= 3,
  },
  {
    chapter: "Your turn",
    title: "Presets and beyond",
    body: "Presets load a whole personality at once: Mario 64, Jak & Daxter, Kirby and more. Start from one, then tweak. Export saves your settings to a file, and Import loads them back.",
    tryIt: "Try at least two presets and feel how different they are.",
    highlight: [],
    done: (e) => e.presetLoads >= 2,
  },
  {
    chapter: "Done",
    title: "That's the tour!",
    body: "You've touched every part of the toolkit. Everything is still here to play with, and you can reopen this tutorial any time from the Tutorial button at the top left.",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  Tutorial state
// ─────────────────────────────────────────────────────────────────────────────

const SEEN_KEY = "platformer-toolkit-3d.tutorial-seen";

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false; // storage blocked: just show the welcome again next time
  }
}
function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

type TutorialState = {
  status: "welcome" | "active" | "off";
  index: number;
  start: Events; // event counts when the current step began
  startValues: SettingValues; // settings when the current step began
  start_tutorial: () => void;
  skip: () => void;
  goTo: (i: number) => void;
  exit: () => void;
  reopen: () => void;
};

export const useTutorial = create<TutorialState>((set, get) => ({
  status: typeof window !== "undefined" && readSeen() ? "off" : "welcome",
  index: 0,
  start: snapshotEvents(),
  startValues: {},
  start_tutorial: () => {
    markSeen();
    // Begin from the Default preset so every step's setup makes sense
    useSettings.getState().load(presetValues(PRESETS[0]!));
    get().goTo(0);
    set({ status: "active" });
  },
  skip: () => {
    markSeen();
    set({ status: "off" });
  },
  goTo: (i) => {
    const step = STEPS[i];
    if (!step) return;
    const settings = useSettings.getState();
    for (const [k, v] of Object.entries(step.setup ?? {})) settings.set(k, v);
    if (step.highlight?.length) {
      const ui = useUI.getState();
      if (!ui.panelOpen) ui.toggle("panelOpen");
    }
    set({ index: i, start: snapshotEvents(), startValues: { ...useSettings.getState().values } });
  },
  exit: () => set({ status: "off" }),
  // Resume where you left off (or restart if you'd finished)
  reopen: () => {
    const { index } = get();
    if (index >= STEPS.length - 1) get().start_tutorial();
    else {
      get().goTo(index);
      set({ status: "active" });
    }
  },
}));

/** Events that happened since the current step started. */
export function eventsSinceStart(): Events {
  const s = useTutorial.getState().start;
  const out = { ...events };
  for (const k of Object.keys(out) as (keyof Events)[]) out[k] = events[k] - s[k];
  return out;
}

/** Setting keys the current step highlights (empty when the tutorial is off). */
const NONE: string[] = []; // one shared empty list, so the selector's result stays stable
export function useHighlighted(): string[] {
  return useTutorial((t) => (t.status === "active" ? STEPS[t.index]?.highlight ?? NONE : NONE));
}
