import { create } from "zustand";

export type SettingDef = {
  key: string;
  label: string;
  category: "Movement" | "Jump" | "Moves" | "Camera" | "Juice";
  kind: "number" | "boolean" | "choice";
  /** For kind "choice": the options shown as a segmented switch */
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  default: number | boolean | string;
  description: string;
  /** Only show when this setting is on (boolean) or equals `showWhen` */
  dependsOn?: string;
  showWhen?: string;
};

// Add a new tunable by adding ONE entry here — the panel is generated from it.
export const SETTINGS: SettingDef[] = [
  { key: "maxSpeed", label: "Max Speed", category: "Movement", kind: "number", min: 1, max: 30, step: 0.5, unit: "u/s", default: 8, description: "The fastest the character can run on the ground." },
  { key: "acceleration", label: "Acceleration", category: "Movement", kind: "number", min: 1, max: 200, step: 1, unit: "u/s²", default: 40, description: "How quickly the character reaches top speed when you start moving." },
  { key: "deceleration", label: "Deceleration", category: "Movement", kind: "number", min: 1, max: 200, step: 1, unit: "u/s²", default: 50, description: "How quickly the character stops once you let go of the controls." },
  { key: "turnSpeed", label: "Turn Speed", category: "Movement", kind: "number", min: 1, max: 40, step: 0.5, default: 12, description: "How fast the character rotates to face the direction it's moving." },

  { key: "jumpHeight", label: "Jump Height", category: "Jump", kind: "number", min: 0.5, max: 10, step: 0.1, unit: "u", default: 3, description: "How high a full jump reaches, in world units." },
  { key: "timeToApex", label: "Time to Apex", category: "Jump", kind: "number", min: 0.1, max: 1.5, step: 0.01, unit: "s", default: 0.4, description: "Seconds to reach the top of a jump. Lower feels snappier, higher feels floatier." },
  { key: "fallGravityMultiplier", label: "Fall Gravity Multiplier", category: "Jump", kind: "number", min: 1, max: 5, step: 0.1, unit: "×", default: 1.8, description: "Extra gravity while falling, for snappier, less floaty landings." },
  { key: "variableJumpHeight", label: "Variable Jump Height", category: "Jump", kind: "boolean", default: true, description: "Releasing Space early cuts the jump short, so taps give small hops." },
  { key: "airControl", label: "Air Control", category: "Jump", kind: "number", min: 0, max: 1, step: 0.05, default: 0.6, description: "How much you can steer in mid-air. 0 is none, 1 is the same as on the ground." },
  { key: "maxFallSpeed", label: "Max Fall Speed", category: "Jump", kind: "number", min: 2, max: 80, step: 1, unit: "u/s", default: 25, description: "The terminal velocity — falling never gets faster than this." },
  { key: "coyoteTime", label: "Coyote Time", category: "Jump", kind: "number", min: 0, max: 0.5, step: 0.01, unit: "s", default: 0.1, description: "Grace period where you can still jump after walking off a ledge." },
  { key: "jumpBuffer", label: "Jump Buffer", category: "Jump", kind: "number", min: 0, max: 0.5, step: 0.01, unit: "s", default: 0.1, description: "Pressing jump this long before landing still counts as a jump." },

  { key: "doubleJump", label: "Double Jump", category: "Moves", kind: "boolean", default: false, description: "Press jump again in mid-air for an extra jump, and steer toward a new direction as you do (like Jak)." },
  { key: "airJumps", label: "Air Jumps", category: "Moves", kind: "number", min: 1, max: 3, step: 1, default: 1, description: "How many extra jumps you get before touching the ground. 2 makes a triple jump.", dependsOn: "doubleJump" },
  { key: "doubleJumpHeight", label: "Air Jump Height", category: "Moves", kind: "number", min: 0.3, max: 1.5, step: 0.05, unit: "×", default: 0.8, description: "Height of each air jump, compared to a normal jump.", dependsOn: "doubleJump" },
  { key: "longJump", label: "Long Jump", category: "Moves", kind: "boolean", default: false, description: "While running, hold Shift and press jump for a long, low, fast leap (like Mario 64). Holding Shift on the ground makes you crouch and slide to a stop." },
  { key: "longJumpSpeed", label: "Long Jump Speed", category: "Moves", kind: "number", min: 8, max: 30, step: 0.5, unit: "u/s", default: 16, description: "How fast you fly forward during a long jump.", dependsOn: "longJump" },
  { key: "longJumpHeight", label: "Long Jump Height", category: "Moves", kind: "number", min: 0.3, max: 4, step: 0.1, unit: "u", default: 1.4, description: "How high a long jump arcs. Lower is flatter and faster to land.", dependsOn: "longJump" },
  { key: "groundPound", label: "Ground Pound", category: "Moves", kind: "boolean", default: false, description: "Press Shift in mid-air to flip, hang for a moment, then slam straight down." },
  { key: "poundStall", label: "Hang Time", category: "Moves", kind: "number", min: 0, max: 0.6, step: 0.02, unit: "s", default: 0.25, description: "How long you hang in the air before slamming down.", dependsOn: "groundPound" },
  { key: "poundSpeed", label: "Slam Speed", category: "Moves", kind: "number", min: 10, max: 60, step: 1, unit: "u/s", default: 35, description: "How fast you drop during the slam.", dependsOn: "groundPound" },
  { key: "wallJump", label: "Wall Jump", category: "Moves", kind: "boolean", default: false, description: "Jump into a wall in mid-air, then press jump again as you hit it to kick off the other way (like Mario 64). Try the tall wall." },
  { key: "wallJumpHeight", label: "Wall Jump Height", category: "Moves", kind: "number", min: 0.5, max: 6, step: 0.1, unit: "u", default: 3, description: "How high a wall kick sends you.", dependsOn: "wallJump" },
  { key: "wallJumpPush", label: "Wall Push", category: "Moves", kind: "number", min: 2, max: 20, step: 0.5, unit: "u/s", default: 9, description: "How hard a wall kick pushes you away from the wall.", dependsOn: "wallJump" },
  { key: "wallJumpWindow", label: "Wall Jump Window", category: "Moves", kind: "number", min: 0.05, max: 0.5, step: 0.01, unit: "s", default: 0.2, description: "How long after touching a wall you can still kick off it. Mario 64 was famously strict.", dependsOn: "wallJump" },
  { key: "float", label: "Float (Kirby)", category: "Moves", kind: "boolean", default: false, description: "Once you're out of air jumps, each press of jump in mid-air is a flap that lifts you a little, and you drift down slowly in between (like Kirby). Press Shift to exhale and drop." },
  { key: "floatFlaps", label: "Max Flaps", category: "Moves", kind: "number", min: 1, max: 10, step: 1, default: 5, description: "How many flaps you get before landing. Once they're used up you keep gliding down slowly.", dependsOn: "float" },
  { key: "flapLift", label: "Flap Lift", category: "Moves", kind: "number", min: 2, max: 12, step: 0.5, unit: "u/s", default: 6, description: "How much each flap lifts you.", dependsOn: "float" },
  { key: "floatFallSpeed", label: "Float Fall Speed", category: "Moves", kind: "number", min: 0.5, max: 6, step: 0.25, unit: "u/s", default: 2, description: "The fastest you sink while floating. Lower feels more like hovering.", dependsOn: "float" },
  { key: "floatMoveSpeed", label: "Float Move Speed", category: "Moves", kind: "number", min: 0.2, max: 1, step: 0.05, unit: "×", default: 0.55, description: "How fast you can move sideways while floating, compared to running.", dependsOn: "float" },

  { key: "cameraDistance", label: "Distance", category: "Camera", kind: "number", min: 2, max: 25, step: 0.5, unit: "u", default: 8, description: "How far the camera sits from the player." },
  { key: "cameraHeight", label: "Height", category: "Camera", kind: "number", min: 0, max: 15, step: 0.25, unit: "u", default: 3, description: "How high above the player the camera sits." },
  { key: "leashSwing", label: "Leash Swing", category: "Camera", kind: "number", min: 0, max: 1, step: 0.05, default: 1, description: "The camera acts like it's tied to the player with a rope, so turning and running sideways pull it around (like Jak and Daxter or Mario 64). 0 never swings, 1 is the full rope." },
  { key: "followSmoothing", label: "Follow Smoothing", category: "Camera", kind: "number", min: 0, max: 1, step: 0.01, unit: "s", default: 0.15, description: "How much the camera lags behind the player. 0 is locked on." },
  { key: "autoRotate", label: "Auto-Rotate Behind Player", category: "Camera", kind: "boolean", default: true, description: "An extra pull that slowly swings the camera behind you while you run away from it, on top of the leash." },
  { key: "autoRotateSpeed", label: "Auto-Rotate Speed", category: "Camera", kind: "number", min: 0.1, max: 10, step: 0.1, default: 2, description: "How quickly the camera swings behind the player.", dependsOn: "autoRotate" },
  { key: "cameraObstruction", label: "Obstruction", category: "Camera", kind: "choice", options: [{ value: "fade", label: "Fade" }, { value: "push", label: "Push In" }, { value: "off", label: "Off" }], default: "fade", description: "What happens when something gets between the camera and the player. Fade makes it see-through. Push In moves the camera closer, like Mario 64. Off ignores it." },
  { key: "fadeOpacity", label: "Fade Opacity", category: "Camera", kind: "number", min: 0, max: 0.9, step: 0.05, default: 0.25, description: "How visible blocking objects stay when faded. 0 is invisible.", dependsOn: "cameraObstruction", showWhen: "fade" },
  { key: "playerSilhouette", label: "Player Silhouette", category: "Camera", kind: "boolean", default: true, description: "Shows the player as a coloured outline whenever something hides them, so you never lose track of where you are." },

  { key: "squashStretch", label: "Squash & Stretch", category: "Juice", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5, description: "The character stretches as it jumps and squashes when it lands, then springs back. Harder landings squash more. 0 turns it off." },
  { key: "dust", label: "Dust Puffs", category: "Juice", kind: "boolean", default: true, description: "A puff of dust when you jump, and a ring of dust when you land. Bigger landings kick up more." },
  { key: "landingBump", label: "Landing Bump", category: "Juice", kind: "number", min: 0, max: 1, step: 0.05, default: 0.35, description: "The camera dips slightly when you land, so heavy landings feel heavy. 0 turns it off." },
  { key: "speedFov", label: "Speed FOV", category: "Juice", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5, description: "The camera's view widens as you go faster, which makes speed feel faster. Kicks in above a jog, so it shows most on fast characters like Sonic. 0 turns it off." },
  { key: "speedLines", label: "Speed Lines", category: "Juice", kind: "boolean", default: true, description: "Streaks around the edges of the screen at high speed, fading in as you get faster." },
  { key: "skidEffects", label: "Skid Effects", category: "Juice", kind: "boolean", default: true, description: "When you turn sharply or reverse while running fast, your feet kick up a trail of dust and you hear a skid. It shows best on fast characters that turn slowly, like Sonic." },
  { key: "skidSound", label: "Skid Sound", category: "Juice", kind: "choice", options: [{ value: "retro", label: "Retro" }, { value: "scuff", label: "Scuff" }, { value: "screech", label: "Screech" }], default: "retro", description: "The sound a skid makes. Retro is a gritty 16-bit style brake, Scuff a soft shoe-scrape, and Screech a tire squeal.", dependsOn: "skidEffects" },
  { key: "sounds", label: "Sound Effects", category: "Juice", kind: "boolean", default: true, description: "Simple jump and landing sounds, generated in the browser." },
  { key: "soundVolume", label: "Volume", category: "Juice", kind: "number", min: 0, max: 1, step: 0.05, default: 0.5, description: "How loud the sound effects are.", dependsOn: "sounds" },
];

export type SettingValues = Record<string, number | boolean | string>;

export const defaultValues = (): SettingValues =>
  Object.fromEntries(SETTINGS.map((s) => [s.key, s.default]));

export type Preset = { name: string; description: string; values: SettingValues };

// Each preset only lists what it changes; anything left out uses the default.
// These are hand-tuned to capture the *feel* of each style, not measured from the games.
export const PRESETS: Preset[] = [
  { name: "Default", description: "A balanced starting point.", values: {} },
  {
    name: "Mario 64",
    description: "Momentum-heavy running, big committed jumps, limited air steering, and a lazy trailing camera.",
    values: {
      maxSpeed: 9, acceleration: 22, deceleration: 30, turnSpeed: 7,
      jumpHeight: 3.2, timeToApex: 0.42, fallGravityMultiplier: 1.5, airControl: 0.35, maxFallSpeed: 30,
      coyoteTime: 0.08, jumpBuffer: 0.1,
      cameraDistance: 9, cameraHeight: 3.5, followSmoothing: 0.22, leashSwing: 1, autoRotate: true, autoRotateSpeed: 1.5,
      cameraObstruction: "push", playerSilhouette: false,
      longJump: true, groundPound: true, wallJump: true, wallJumpWindow: 0.1,
    },
  },
  {
    name: "Jak & Daxter",
    description: "Responsive, quick-turning movement with a fairly short jump and generous air control.",
    values: {
      maxSpeed: 10, acceleration: 60, deceleration: 70, turnSpeed: 16,
      jumpHeight: 2.6, timeToApex: 0.34, fallGravityMultiplier: 1.8, airControl: 0.75, maxFallSpeed: 28,
      coyoteTime: 0.12, jumpBuffer: 0.12,
      cameraDistance: 8, cameraHeight: 3, followSmoothing: 0.12, leashSwing: 1, autoRotate: true, autoRotateSpeed: 2.5,
      doubleJump: true, doubleJumpHeight: 0.85, longJump: true, longJumpSpeed: 14, longJumpHeight: 1.6,
    },
  },
  {
    name: "Floaty",
    description: "Slow, drifty and dreamlike. Long hang time, gentle falls, lots of air control.",
    values: {
      maxSpeed: 6, acceleration: 14, deceleration: 12, turnSpeed: 6,
      jumpHeight: 4, timeToApex: 0.8, fallGravityMultiplier: 1, airControl: 0.9, maxFallSpeed: 10,
      coyoteTime: 0.15, jumpBuffer: 0.15,
      followSmoothing: 0.35,
      doubleJump: true, airJumps: 2, doubleJumpHeight: 0.7,
    },
  },
  {
    name: "Tight & Snappy",
    description: "Instant starts and stops, fast short jumps that fall hard, and full air control.",
    values: {
      maxSpeed: 11, acceleration: 140, deceleration: 160, turnSpeed: 30,
      jumpHeight: 2.8, timeToApex: 0.28, fallGravityMultiplier: 2.6, airControl: 1, maxFallSpeed: 40,
      coyoteTime: 0.1, jumpBuffer: 0.12,
      followSmoothing: 0.06,
      doubleJump: true, wallJump: true, wallJumpWindow: 0.25,
    },
  },
  {
    name: "Heavy",
    description: "A weighty character that's slow to get going, can barely steer in the air, and always jumps the same height.",
    values: {
      maxSpeed: 7, acceleration: 10, deceleration: 9, turnSpeed: 4,
      jumpHeight: 1.6, timeToApex: 0.38, fallGravityMultiplier: 1.3, variableJumpHeight: false, airControl: 0.15,
      coyoteTime: 0.03, jumpBuffer: 0.05,
      followSmoothing: 0.3,
      groundPound: true, poundStall: 0.1, poundSpeed: 50,
    },
  },
  {
    name: "Kirby",
    description: "Small, bouncy and light. A modest jump, then flap your way up and float gently back down.",
    values: {
      maxSpeed: 6.5, acceleration: 35, deceleration: 40, turnSpeed: 14,
      jumpHeight: 2.2, timeToApex: 0.36, fallGravityMultiplier: 1.4, airControl: 0.8, maxFallSpeed: 20,
      coyoteTime: 0.1, jumpBuffer: 0.12,
      followSmoothing: 0.2,
      float: true, floatFlaps: 6, flapLift: 6.5, floatFallSpeed: 1.75, floatMoveSpeed: 0.55,
    },
  },
  {
    name: "Sonic",
    description: "Built for speed. A slow build-up to a very high top speed, wide turns when going fast, a quick snappy jump, and the camera pulled back so you can see what's coming.",
    values: {
      maxSpeed: 22, acceleration: 16, deceleration: 28, turnSpeed: 8,
      jumpHeight: 3.4, timeToApex: 0.36, fallGravityMultiplier: 1.7, airControl: 0.55, maxFallSpeed: 40,
      coyoteTime: 0.1, jumpBuffer: 0.12,
      cameraDistance: 12, cameraHeight: 3.5, followSmoothing: 0.08, autoRotateSpeed: 3.5,
    },
  },
];

/** Full value set a preset produces (defaults + its overrides). */
export const presetValues = (p: Preset): SettingValues => ({ ...defaultValues(), ...p.values });

/** Name of the preset the current values exactly match, or null if they've been customised. */
export const matchingPreset = (v: SettingValues): string | null => {
  for (const p of PRESETS) {
    const pv = presetValues(p);
    if (SETTINGS.every((s) => pv[s.key] === v[s.key])) return p.name;
  }
  return null;
};

type Store = {
  values: SettingValues;
  set: (key: string, v: number | boolean | string) => void;
  reset: () => void;
  load: (obj: Record<string, unknown>) => number;
};

export const useSettings = create<Store>((set) => ({
  values: defaultValues(),
  set: (key, v) => set((s) => ({ values: { ...s.values, [key]: v } })),
  reset: () => set({ values: defaultValues() }),
  load: (obj) => {
    const next = defaultValues();
    let n = 0;
    for (const def of SETTINGS) {
      const v = obj[def.key];
      if (def.kind === "boolean" && typeof v === "boolean") { next[def.key] = v; n++; }
      if (def.kind === "choice" && typeof v === "string" && def.options?.some((o) => o.value === v)) { next[def.key] = v; n++; }
      if (def.kind === "number" && typeof v === "number" && Number.isFinite(v)) {
        next[def.key] = Math.min(def.max ?? Infinity, Math.max(def.min ?? -Infinity, v));
        n++;
      }
    }
    set({ values: next });
    return n;
  },
}));

export const num = (v: SettingValues, k: string) => v[k] as number;
export const bool = (v: SettingValues, k: string) => v[k] as boolean;
export const str = (v: SettingValues, k: string) => v[k] as string;

/** gravity = 2h / t², jumpVelocity = g * t */
export function deriveJump(height: number, timeToApex: number) {
  const gravity = (2 * height) / (timeToApex * timeToApex);
  return { gravity, jumpVelocity: gravity * timeToApex };
}

type UI = {
  panelOpen: boolean;
  showDebug: boolean;
  showTrail: boolean;
  showGhost: boolean;
  toggle: (k: "panelOpen" | "showDebug" | "showTrail" | "showGhost") => void;
};
export const useUI = create<UI>((set) => ({
  panelOpen: true,
  showDebug: true,
  showTrail: true,
  showGhost: true,
  toggle: (k) => set((s) => ({ [k]: !s[k] }) as Partial<UI>),
}));

/** Mutable live stats written by the player each frame, polled by the HUD. */
export const liveStats = { speed: 0, vy: 0, grounded: false, gravity: 0, jumpVelocity: 0, move: "—", speedT: 0 };
