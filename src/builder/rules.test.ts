import { describe, it, expect } from "vitest";
import { formatTime, goalMissing, levelChecklist, touchesFlag, touchesStar } from "./rules";
import type { Block } from "./pieces";

const at = (piece: Block["piece"], x: number, y: number, z: number): Block => ({ id: `${piece}${x}${y}${z}`, piece, x, y, z, rot: 0 });

describe("goal rules", () => {
  it("knows what each goal needs", () => {
    const start = at("start", 0, 0, 0);
    expect(goalMissing("flag", [start])).toMatch(/Goal flag/);
    expect(goalMissing("time", [start, at("goal", 3, 0, 0)])).toBeNull();
    expect(goalMissing("stars", [start])).toMatch(/stars/);
    expect(goalMissing("none", [])).toBeNull();
    const list = levelChecklist("stars", [start, at("star", 1, 1, 1), at("star", 2, 1, 1), at("goal", 3, 0, 0)]);
    expect(list.map((c) => c.text)).toEqual(["A Start pad, where you begin", "2 stars to collect", "The Goal flag isn't used in this mode"]);
  });

  it("collects a star when the player passes through it", () => {
    const star = at("star", 4, 1, 4); // centre (4.5, 1.5, 4.5)
    expect(touchesStar({ x: 4.5, y: 1.95, z: 4.5 }, star)).toBe(true); // standing in its cell
    expect(touchesStar({ x: 5.1, y: 2.2, z: 4.6 }, star)).toBe(true); // brushing past
    expect(touchesStar({ x: 6, y: 1.95, z: 4.5 }, star)).toBe(false);
    expect(touchesStar({ x: 4.5, y: 4, z: 4.5 }, star)).toBe(false); // well above
  });

  it("reaches the flag by standing on its pad or touching the pole", () => {
    const flag = at("goal", 0, 2, 0); // pad at y 2..2.2
    expect(touchesFlag({ x: 0.5, y: 2.2 + 0.95, z: 0.5 }, flag)).toBe(true); // standing on the pad
    expect(touchesFlag({ x: 1.2, y: 3.6, z: 0.4 }, flag)).toBe(true); // jumping past the pole
    expect(touchesFlag({ x: 0.5, y: 0.95, z: 0.5 }, flag)).toBe(false); // underneath
    expect(touchesFlag({ x: 2, y: 3.2, z: 0.5 }, flag)).toBe(false);
  });

  it("formats times", () => {
    expect(formatTime(9.876)).toBe("9.88s");
    expect(formatTime(62.5)).toBe("1:02.50");
  });
});
