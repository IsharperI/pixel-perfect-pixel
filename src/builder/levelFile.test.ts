import { describe, it, expect, beforeEach } from "vitest";
import { LEVEL_FORMAT, deleteSavedLevel, levelFileName, listSavedLevels, readLevelFile, saveBestTime, saveLevelToBrowser, toLevelFile } from "./levelFile";
import { starterLevel } from "./pieces";
import { DEFAULT_RULES } from "./rules";

const R = { ...DEFAULT_RULES, stars: true, need: "any" as const, clock: "countdown" as const, limit: 45 };

describe("level files", () => {
  it("round-trips a level through its file", () => {
    const blocks = starterLevel();
    const file = JSON.parse(JSON.stringify(toLevelFile({ name: "Sky castle", rules: R, bestTime: 12.5, blocks })));
    expect(file.format).toBe(LEVEL_FORMAT);
    const back = readLevelFile(file)!;
    expect(back.name).toBe("Sky castle");
    expect(back.rules).toEqual(R);
    expect(back.bestTime).toBe(12.5);
    expect(back.blocks.map(({ id: _, ...b }) => b)).toEqual(blocks.map(({ id: _, ...b }) => b));
  });

  it("saves moving platforms", () => {
    const move = { stops: [[2, 1, 0]] as [number, number, number][], speed: 1.5, wait: 0, trigger: "step" as const, loop: true };
    const blocks = [{ id: "a", piece: "wide" as const, x: 0, y: 1, z: 0, rot: 0, move }, { id: "b", piece: "ramp" as const, x: 4, y: 0, z: 0, rot: 0 }];
    const back = readLevelFile(JSON.parse(JSON.stringify(toLevelFile({ name: "M", rules: DEFAULT_RULES, bestTime: null, blocks }))))!;
    expect(back.blocks[0]!.move).toEqual(move);
    expect("move" in back.blocks[1]!).toBe(false);
  });

  it("rejects things that aren't level files", () => {
    expect(readLevelFile(null)).toBeNull();
    expect(readLevelFile({ format: "platformer-toolkit-3d/character", values: {} })).toBeNull();
    expect(readLevelFile({ jumpHeight: 3 })).toBeNull();
  });

  it("drops broken, unknown and overlapping pieces, and fixes bad settings", () => {
    const level = readLevelFile({
      format: LEVEL_FORMAT, name: "  ", rules: { flag: "yes", stars: true, need: "?", clock: "countdown", limit: 99999 }, bestTime: -3,
      blocks: [
        { piece: "cube", x: 0, y: 0, z: 0, rot: 0 },
        { piece: "cube", x: 0, y: 0, z: 0, rot: 0 }, // overlaps
        { piece: "dragon", x: 2, y: 0, z: 0 },
        { piece: "cube", x: 1.5, y: 0, z: 0 },
        { piece: "ramp", x: 4, y: 0, z: 0, rot: 5 },
        { piece: "goal", x: 6, y: 0, z: 0 }, { piece: "goal", x: 8, y: 0, z: 0 }, // only one goal
      ],
    })!;
    expect(level.name).toBe("My level");
    expect(level.rules).toEqual({ flag: true, stars: true, need: "all", clock: "countdown", limit: 600 });
    expect(level.bestTime).toBeNull();
    expect(level.blocks.map((b) => [b.piece, b.x, b.rot])).toEqual([["cube", 0, 0], ["ramp", 4, 1], ["goal", 6, 0]]);
  });

  it("opens older files that had a single goal", () => {
    const old = (goal: string) => readLevelFile({ format: LEVEL_FORMAT, version: 1, goal, blocks: [] })!.rules;
    expect(old("flag")).toMatchObject({ flag: true, stars: false, clock: "none" });
    expect(old("stars")).toMatchObject({ flag: false, stars: true, clock: "none" });
    expect(old("time")).toMatchObject({ flag: true, stars: false, clock: "trial" });
    expect(old("none")).toMatchObject({ flag: false, stars: false });
  });

  it("makes safe file names", () => {
    expect(levelFileName("Sky Castle!! 2")).toBe("sky-castle-2.level.json");
    expect(levelFileName("???")).toBe("level.level.json");
  });
});

describe("browser save slots", () => {
  beforeEach(() => window.localStorage.clear());

  it("saves, overwrites, updates best time, and deletes", () => {
    const blocks = starterLevel();
    expect(saveLevelToBrowser("a", { name: "One", rules: DEFAULT_RULES, bestTime: null, blocks })).toBe(true);
    expect(saveLevelToBrowser("b", { name: "Two", rules: DEFAULT_RULES, bestTime: null, blocks })).toBe(true);
    expect(saveLevelToBrowser("a", { name: "One again", rules: DEFAULT_RULES, bestTime: null, blocks })).toBe(true);
    let list = listSavedLevels();
    expect(list.map((s) => s.name).sort()).toEqual(["One again", "Two"]);
    saveBestTime("b", 9.8);
    expect(readLevelFile(listSavedLevels().find((s) => s.id === "b")!.file)!.bestTime).toBe(9.8);
    deleteSavedLevel("a");
    list = listSavedLevels();
    expect(list.map((s) => s.id)).toEqual(["b"]);
  });
});
