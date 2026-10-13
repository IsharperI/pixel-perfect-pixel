import { describe, it, expect } from "vitest";
import { blocksInRect, cellRect, fillRect, MAX_DRAW } from "./drag";
import type { Block } from "./pieces";

const cube = { piece: "cube" as const, x: 0, y: 0, z: 0, rot: 0 };

describe("drag to draw", () => {
  it("fills a rectangle of cubes in any direction", () => {
    expect(fillRect(cube, 2.5, 1.2, [])).toHaveLength(3 * 2);
    expect(fillRect(cube, -1.5, -0.5, [])).toHaveLength(3 * 2);
    expect(fillRect(cube, 0.5, 0.5, [])).toHaveLength(1);
  });

  it("tiles bigger pieces by their own size", () => {
    const wide = { ...cube, piece: "wide" as const };
    const out = fillRect(wide, 5.9, 1.9, []);
    expect(out.map((b) => b.x)).toEqual([0, 2, 4]);
    expect(out.every((b) => b.z === 0)).toBe(true);
    // A turned plank is 1 wide and 3 long in z
    const planks = fillRect({ ...cube, piece: "plank", rot: 1 }, 1.5, 5.5, []);
    expect(planks).toHaveLength(2 * 2);
  });

  it("skips spots that are taken and never duplicates the Start pad", () => {
    const blocks: Block[] = [{ id: "a", ...cube, x: 1 }];
    expect(fillRect(cube, 2.5, 0.5, blocks).map((b) => b.x)).toEqual([0, 2]);
    expect(fillRect({ ...cube, piece: "start" }, 5, 5, [])).toHaveLength(1);
  });

  it("caps very large drags", () => {
    expect(fillRect(cube, 29.5, 29.5, []).length).toBeLessThanOrEqual(MAX_DRAW);
  });
});

describe("drag to erase", () => {
  const blocks: Block[] = [
    { id: "a", ...cube },
    { id: "b", ...cube, x: 3 },
    { id: "c", ...cube, y: 1 },
    { id: "w", ...cube, piece: "wide", x: 5, z: 5 },
  ];
  it("finds blocks on one layer inside the rectangle", () => {
    expect(blocksInRect(cellRect(0.2, 0.2, 2.7, 0.9), 0, blocks).map((b) => b.id)).toEqual(["a"]);
    expect(blocksInRect(cellRect(-1, -1, 4, 1), 0, blocks).map((b) => b.id)).toEqual(["a", "b"]);
    expect(blocksInRect(cellRect(-1, -1, 4, 1), 1, blocks).map((b) => b.id)).toEqual(["c"]);
    // touching any part of a big block counts
    expect(blocksInRect(cellRect(6.5, 6.5, 6.5, 6.5), 0, blocks).map((b) => b.id)).toEqual(["w"]);
  });
});
