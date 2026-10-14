import { describe, it, expect } from "vitest";
import {
  DEFAULT_RULES, flagLocked, formatCountdown, formatLimit, formatTime, goalMissing, goalSentence, hasWon, levelChecklist, touchesFlag, touchesStar,
  type Rules,
} from "./rules";
import type { Block } from "./pieces";

const at = (piece: Block["piece"], x: number, y: number, z: number): Block => ({ id: `${piece}${x}${y}${z}`, piece, x, y, z, rot: 0 });
const rules = (r: Partial<Rules>): Rules => ({ ...DEFAULT_RULES, ...r });

describe("winning", () => {
  const flagOnly = rules({ flag: true, stars: false });
  const starsOnly = rules({ flag: false, stars: true });
  const all = rules({ flag: true, stars: true, need: "all" });
  const any = rules({ flag: true, stars: true, need: "any" });

  it("wins with just the flag or just the stars", () => {
    expect(hasWon(flagOnly, { touchingFlag: true, collected: 0, totalStars: 3 })).toBe(true);
    expect(hasWon(starsOnly, { touchingFlag: true, collected: 2, totalStars: 3 })).toBe(false);
    expect(hasWon(starsOnly, { touchingFlag: false, collected: 3, totalStars: 3 })).toBe(true);
  });

  it("'all' locks the flag until every star is collected", () => {
    expect(flagLocked(all, 2, 3)).toBe(true);
    expect(hasWon(all, { touchingFlag: true, collected: 2, totalStars: 3 })).toBe(false);
    expect(hasWon(all, { touchingFlag: false, collected: 3, totalStars: 3 })).toBe(false);
    expect(hasWon(all, { touchingFlag: true, collected: 3, totalStars: 3 })).toBe(true);
    expect(flagLocked(any, 0, 3)).toBe(false);
  });

  it("'any' wins with either", () => {
    expect(hasWon(any, { touchingFlag: true, collected: 0, totalStars: 3 })).toBe(true);
    expect(hasWon(any, { touchingFlag: false, collected: 3, totalStars: 3 })).toBe(true);
    expect(hasWon(any, { touchingFlag: false, collected: 1, totalStars: 3 })).toBe(false);
  });

  it("a playground can't be won", () => {
    expect(hasWon(rules({ flag: false, stars: false }), { touchingFlag: true, collected: 3, totalStars: 3 })).toBe(false);
  });

  it("describes the goal", () => {
    expect(goalSentence(all)).toBe("Collect all the collectables, then reach the flag");
    expect(goalSentence(any)).toBe("Reach the flag or collect all the collectables");
    expect(goalSentence(rules({ flag: false }))).toBe("Just a playground");
  });
});

describe("level checks", () => {
  it("knows what each goal needs", () => {
    const start = at("start", 0, 0, 0);
    expect(goalMissing(rules({ flag: true }), [start])).toMatch(/Goal flag/);
    expect(goalMissing(rules({ flag: false, stars: true }), [start])).toMatch(/collectables/);
    expect(goalMissing(rules({ flag: true, stars: true, need: "any" }), [start, at("star", 1, 1, 1)])).toBeNull();
    expect(goalMissing(rules({ flag: false }), [])).toBeNull();
    const list = levelChecklist(rules({ flag: false, stars: true }), [start, at("star", 1, 1, 1), at("star", 2, 1, 1), at("goal", 3, 0, 0)]);
    expect(list.map((c) => c.ok)).toEqual([true, true, true]);
    expect(list[1]!.text).toBe("2 collectables to grab");
    expect(levelChecklist(rules({ flag: false, clock: "countdown" }), [start]).some((c) => !c.ok)).toBe(true);
  });
});

describe("touching things", () => {
  it("collects a star when the player passes through it", () => {
    const star = at("star", 4, 1, 4); // centre (4.5, 1.5, 4.5)
    expect(touchesStar({ x: 4.5, y: 1.95, z: 4.5 }, star)).toBe(true);
    expect(touchesStar({ x: 5.1, y: 2.2, z: 4.6 }, star)).toBe(true);
    expect(touchesStar({ x: 6, y: 1.95, z: 4.5 }, star)).toBe(false);
    expect(touchesStar({ x: 4.5, y: 4, z: 4.5 }, star)).toBe(false);
  });

  it("reaches the flag by standing on its pad or touching the pole", () => {
    const flag = at("goal", 0, 2, 0);
    expect(touchesFlag({ x: 0.5, y: 2.2 + 0.95, z: 0.5 }, flag)).toBe(true);
    expect(touchesFlag({ x: 1.2, y: 3.6, z: 0.4 }, flag)).toBe(true);
    expect(touchesFlag({ x: 0.5, y: 0.95, z: 0.5 }, flag)).toBe(false);
    expect(touchesFlag({ x: 2, y: 3.2, z: 0.5 }, flag)).toBe(false);
  });
});

describe("time", () => {
  it("formats times", () => {
    expect(formatTime(9.876)).toBe("9.88s");
    expect(formatTime(62.5)).toBe("1:02.50");
    expect(formatCountdown(75)).toBe("1:15");
    expect(formatCountdown(9.34)).toBe("9.3");
    expect(formatCountdown(-2)).toBe("0.0");
    expect(formatLimit(45)).toBe("45 sec");
    expect(formatLimit(90)).toBe("1 min 30 sec");
    expect(formatLimit(120)).toBe("2 min");
  });
});
