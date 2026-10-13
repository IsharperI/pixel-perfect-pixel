/**
 * The level's rules: what wins it (reach the flag, collect the stars, or both),
 * and its clock (none, a time trial stopwatch, or a countdown). Plain functions,
 * so they're easy to test.
 */
import type { Block } from "./pieces";

export type Clock = "none" | "trial" | "countdown";

export type Rules = {
  /** Reaching the flag wins (or counts toward winning) */
  flag: boolean;
  /** Collecting every star wins (or counts toward winning) */
  stars: boolean;
  /** With both ticked: do all of them, or any one? */
  need: "all" | "any";
  clock: Clock;
  /** Countdown length in seconds */
  limit: number;
};

export const DEFAULT_RULES: Rules = { flag: true, stars: false, need: "all", clock: "none", limit: 60 };

export const LIMIT_MIN = 10, LIMIT_MAX = 600, LIMIT_STEP = 5;

export const CLOCK_INFO: Record<Clock, { title: string; blurb: string; emoji: string }> = {
  none: { title: "No clock", blurb: "Take as long as you like.", emoji: "😌" },
  trial: { title: "Time trial", blurb: "A stopwatch. Your best time is remembered.", emoji: "⏱️" },
  countdown: { title: "Countdown", blurb: "Finish before the time runs out!", emoji: "⏳" },
};

/** No goal ticked: a playground to run around in. */
export const isPlayground = (r: Rules) => !r.flag && !r.stars;

/** Both goals and "do all of them": the flag stays locked until every star is collected. */
export const flagLocked = (r: Rules, collected: number, totalStars: number) =>
  r.flag && r.stars && r.need === "all" && totalStars > 0 && collected < totalStars;

/** Has the level been won? */
export function hasWon(r: Rules, s: { touchingFlag: boolean; collected: number; totalStars: number }) {
  const starsDone = s.totalStars > 0 && s.collected >= s.totalStars;
  const flagDone = s.touchingFlag && !flagLocked(r, s.collected, s.totalStars);
  if (r.flag && r.stars) return r.need === "all" ? starsDone && flagDone : starsDone || flagDone;
  if (r.flag) return flagDone;
  if (r.stars) return starsDone;
  return false;
}

/** A short sentence describing what to do, e.g. "Collect all the stars, then reach the flag". */
export function goalSentence(r: Rules): string {
  if (r.flag && r.stars) return r.need === "all" ? "Collect all the stars, then reach the flag" : "Reach the flag or collect all the stars";
  if (r.flag) return "Reach the flag";
  if (r.stars) return "Collect all the stars";
  return "Just a playground";
}

export const goalEmoji = (r: Rules) => (r.flag && r.stars ? "🏁⭐" : r.flag ? "🏁" : r.stars ? "⭐" : "🛝");

/** A checklist for the Level Settings panel: is the level ready for its rules? */
export function levelChecklist(r: Rules, blocks: Block[]) {
  const stars = blocks.filter((b) => b.piece === "star").length;
  const hasFlag = blocks.some((b) => b.piece === "goal");
  const items: { ok: boolean; text: string; warn?: boolean }[] = [
    { ok: blocks.some((b) => b.piece === "start"), text: "A Start pad, where you begin" },
  ];
  if (r.flag) items.push({ ok: hasFlag, text: "A Goal flag to reach" });
  if (r.stars) items.push({ ok: stars > 0, text: stars ? `${stars} star${stars === 1 ? "" : "s"} to collect` : "At least one star to collect" });
  if (!r.flag && hasFlag) items.push({ ok: true, warn: true, text: "The Goal flag is just for show (Reach the flag isn't ticked)" });
  if (isPlayground(r) && r.clock !== "none") items.push({ ok: false, text: "Tick a goal so the clock has something to time" });
  return items;
}

/** What's stopping the level from being winnable, if anything. (Play still works; the HUD shows this.) */
export function goalMissing(r: Rules, blocks: Block[]): string | null {
  const hasFlag = blocks.some((b) => b.piece === "goal");
  const hasStars = blocks.some((b) => b.piece === "star");
  if (r.flag && r.stars && r.need === "any") return hasFlag || hasStars ? null : "Add a Goal flag or some stars to finish this level";
  if (r.flag && !hasFlag) return "Add a Goal flag to finish this level";
  if (r.stars && !hasStars) return "Add some stars to collect";
  return null;
}

/** Turn a goal from an older level file (one goal per level) into rules. */
export function rulesFromOldGoal(goal: unknown): Rules {
  if (goal === "stars") return { ...DEFAULT_RULES, flag: false, stars: true };
  if (goal === "time") return { ...DEFAULT_RULES, clock: "trial" };
  if (goal === "none") return { ...DEFAULT_RULES, flag: false };
  return { ...DEFAULT_RULES };
}

/** Clean up rules read from a file (anything odd falls back to the defaults). */
export function readRules(raw: unknown): Rules {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_RULES };
  const o = raw as Record<string, unknown>;
  const lim = typeof o["limit"] === "number" && Number.isFinite(o["limit"]) ? o["limit"] : DEFAULT_RULES.limit;
  return {
    flag: typeof o["flag"] === "boolean" ? o["flag"] : DEFAULT_RULES.flag,
    stars: typeof o["stars"] === "boolean" ? o["stars"] : DEFAULT_RULES.stars,
    need: o["need"] === "any" ? "any" : "all",
    clock: o["clock"] === "trial" || o["clock"] === "countdown" ? o["clock"] : "none",
    limit: Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, Math.round(lim / LIMIT_STEP) * LIMIT_STEP)),
  };
}

type P = { x: number; y: number; z: number };

/** The player's body centre sits this far above their feet. */
const HALF_HEIGHT = 0.95;

/** Is the player (body centre `p`) touching this star? */
export function touchesStar(p: P, star: Pick<Block, "x" | "y" | "z">) {
  const dx = p.x - (star.x + 0.5), dy = p.y - (star.y + 0.5), dz = p.z - (star.z + 0.5);
  // A generous catch radius around the star, stretched vertically for the character's height
  return dx * dx + dz * dz < 0.8 * 0.8 && Math.abs(dy) < 1.25;
}

/** Is the player touching the flag: standing on its pad, or brushing the pole? */
export function touchesFlag(p: P, flag: Pick<Block, "x" | "y" | "z">) {
  const dx = p.x - (flag.x + 0.5), dz = p.z - (flag.z + 0.5);
  const feet = p.y - HALF_HEIGHT;
  return Math.abs(dx) < 0.85 && Math.abs(dz) < 0.85 && feet > flag.y - 0.5 && feet < flag.y + 2.3;
}

/** "12.34s", or "1:02.34" past a minute. */
export function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60), s = seconds - m * 60;
  return m ? `${m}:${s.toFixed(2).padStart(5, "0")}` : `${s.toFixed(2)}s`;
}

/** A countdown display: "0:45", or "9.3" in the last ten seconds. */
export function formatCountdown(seconds: number) {
  const t = Math.max(0, seconds);
  if (t < 10) return t.toFixed(1);
  const m = Math.floor(t / 60), s = Math.floor(t - m * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** A countdown length for the settings: "45 sec", "1 min 30 sec". */
export function formatLimit(seconds: number) {
  const m = Math.floor(seconds / 60), s = seconds % 60;
  return m ? `${m} min${s ? ` ${s} sec` : ""}` : `${s} sec`;
}
