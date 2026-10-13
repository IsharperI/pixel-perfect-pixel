import { describe, it, expect } from "vitest";
import { footprint, bounds, overlaps, canPlace, spawnPoint, starterLevel, type Block } from "./pieces";

const blk = (piece: Block["piece"], x: number, y: number, z: number, rot = 0): Block => ({ id: `${piece}${x}${y}${z}${rot}`, piece, x, y, z, rot });

describe("pieces", () => {
  it("rotate footprints a quarter turn at a time", () => {
    expect(footprint("plank", 0)).toEqual([3, 1, 1]);
    expect(footprint("plank", 1)).toEqual([1, 1, 3]);
    expect(footprint("plank", 2)).toEqual([3, 1, 1]);
    expect(footprint("ramp", 1)).toEqual([2, 1, 1]);
  });
  it("know which cells they fill", () => {
    expect(bounds(blk("wide", 2, 1, -3))).toEqual({ min: [2, 1, -3], max: [4, 2, -1] });
  });
  it("detect overlaps, but not blocks that just touch", () => {
    expect(overlaps(blk("wide", 0, 0, 0), blk("cube", 1, 0, 1))).toBe(true);
    expect(overlaps(blk("wide", 0, 0, 0), blk("cube", 2, 0, 0))).toBe(false); // side by side
    expect(overlaps(blk("wide", 0, 0, 0), blk("cube", 0, 1, 0))).toBe(false); // stacked on top
  });
  it("refuse overlaps, underground and out-of-bounds spots", () => {
    const level = [blk("wide", 0, 0, 0)];
    expect(canPlace(blk("cube", 0, 1, 0), level)).toBe(true);
    expect(canPlace(blk("cube", 1, 0, 1), level)).toBe(false);
    expect(canPlace(blk("cube", 0, -1, 0), level)).toBe(false);
    expect(canPlace(blk("cube", 40, 0, 0), level)).toBe(false);
  });
  it("let a block move onto its own old spot", () => {
    const a = blk("wide", 0, 0, 0);
    expect(canPlace({ ...a, x: 1 }, [a], a.id)).toBe(true);
  });
  it("spawn the character on the start pad, and the starter level has one", () => {
    expect(spawnPoint([blk("start", 3, 2, -1)])).toEqual([3.5, 2 + 1.2, -0.5]);
    const level = starterLevel();
    expect(level.filter((b) => b.piece === "start")).toHaveLength(1);
    // starter level blocks don't overlap each other
    for (const a of level) for (const b of level) if (a !== b) expect(overlaps(a, b), `${a.piece} vs ${b.piece}`).toBe(false);
  });
});
