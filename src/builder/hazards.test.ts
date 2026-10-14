import { describe, expect, it } from "vitest";
import { bounds, standOnPad, type Block } from "./pieces";
import { touchesBox, touchesFlag } from "./rules";
import { readLevelFile, toLevelFile } from "./levelFile";
import { DEFAULT_RULES } from "./rules";
import { usePlay } from "./playState";
import { respawn } from "../game/respawn";

const lava: Block = { id: "l", piece: "lava", x: 0, y: 0, z: 0, rot: 0 };
const cp: Block = { id: "c", piece: "checkpoint", x: 4, y: 0, z: 0, rot: 0 };
const box = bounds(lava);

describe("lava", () => {
  it("hurts when standing on top", () => expect(touchesBox({ x: 0.5, y: 1 + 0.95, z: 0.5 }, box)).toBe(true));
  it("hurts when walking into a side", () => expect(touchesBox({ x: 1.4, y: 0.95, z: 0.5 }, box)).toBe(true));
  it("is safe a step away", () => expect(touchesBox({ x: 2, y: 0.95, z: 0.5 }, box)).toBe(false));
  it("is safe when jumping over it", () => expect(touchesBox({ x: 0.5, y: 1.5 + 0.95, z: 0.5 }, box)).toBe(false));
  it("hurts from below too", () => expect(touchesBox({ x: 0.5, y: -0.5, z: 0.5 }, box)).toBe(true));
});

describe("checkpoints", () => {
  it("are reached by standing on them", () => expect(touchesFlag({ x: 4.5, y: 0.2 + 0.95, z: 0.5 }, cp)).toBe(true));
  it("give a respawn spot above the pad", () => {
    const [x, y, z] = standOnPad(cp);
    expect([x, z]).toEqual([4.5, 0.5]);
    expect(y).toBeGreaterThan(1);
  });
  it("set the respawn point, and Restart clears it", () => {
    usePlay.getState().reachCheckpoint("c", standOnPad(cp));
    expect(usePlay.getState().checkpoint).toBe("c");
    expect(respawn.point).toEqual(standOnPad(cp));
    usePlay.getState().restart();
    expect(usePlay.getState().checkpoint).toBeNull();
    expect(respawn.point).toBeNull();
  });
  it("round-trip through a level file, several allowed", () => {
    const blocks = [lava, cp, { ...cp, id: "c2", x: 8 }];
    const back = readLevelFile(JSON.parse(JSON.stringify(toLevelFile({ name: "x", rules: DEFAULT_RULES, bestTime: null, blocks }))));
    expect(back?.blocks.map((b) => b.piece)).toEqual(["lava", "checkpoint", "checkpoint"]);
  });
});

describe("homing collectables", () => {
  it("save the homing flag, only on collectables", () => {
    const blocks: Block[] = [
      { id: "a", piece: "star", x: 0, y: 1, z: 0, rot: 0, homing: true },
      { id: "b", piece: "star", x: 2, y: 1, z: 0, rot: 0 },
      { id: "c", piece: "cube", x: 4, y: 0, z: 0, rot: 0, homing: true },
    ];
    const back = readLevelFile(JSON.parse(JSON.stringify(toLevelFile({ name: "x", rules: DEFAULT_RULES, bestTime: null, blocks }))));
    expect(back?.blocks.map((b) => !!b.homing)).toEqual([true, false, false]);
  });
});
