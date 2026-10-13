/**
 * The level's goal rules: what each goal needs, and when the player has touched
 * a star or the flag. Plain functions, so they're easy to test.
 */
import type { Block } from "./pieces";
import type { Goal } from "./levelFile";

export const GOAL_INFO: Record<Goal, { title: string; blurb: string; emoji: string }> = {
  flag: { title: "Reach the flag", blurb: "Get to the checkered flag to win.", emoji: "🏁" },
  stars: { title: "Collect the stars", blurb: "Grab every star to win.", emoji: "⭐" },
  time: { title: "Time trial", blurb: "Race to the flag. Your best time is remembered.", emoji: "⏱️" },
  none: { title: "Just a playground", blurb: "No goal: build and run around for fun.", emoji: "🛝" },
};

/** Does this goal use the flag? */
export const usesFlag = (goal: Goal) => goal === "flag" || goal === "time";

/** A checklist for the Level Settings panel: is the level ready for its goal? */
export function levelChecklist(goal: Goal, blocks: Block[]) {
  const stars = blocks.filter((b) => b.piece === "star").length;
  const hasFlag = blocks.some((b) => b.piece === "goal");
  const items: { ok: boolean; text: string; warn?: boolean }[] = [
    { ok: blocks.some((b) => b.piece === "start"), text: "A Start pad, where you begin" },
  ];
  if (usesFlag(goal)) items.push({ ok: hasFlag, text: "A Goal flag to reach" });
  if (goal === "stars") items.push({ ok: stars > 0, text: stars ? `${stars} star${stars === 1 ? "" : "s"} to collect` : "At least one star to collect" });
  if (goal === "stars" && hasFlag) items.push({ ok: true, warn: true, text: "The Goal flag isn't used in this mode" });
  return items;
}

/** Can the goal be won at all? (If not, Play still works, the HUD just says what's missing.) */
export function goalMissing(goal: Goal, blocks: Block[]): string | null {
  if (usesFlag(goal) && !blocks.some((b) => b.piece === "goal")) return "Add a Goal flag to finish this level";
  if (goal === "stars" && !blocks.some((b) => b.piece === "star")) return "Add some stars to collect";
  return null;
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
