import { describe, it, expect, beforeEach } from "vitest";
import { LEVEL_FORMAT, deleteSavedLevel, levelFileName, listSavedLevels, readLevelFile, saveBestTime, saveLevelToBrowser, toLevelFile } from "./levelFile";
import { starterLevel } from "./pieces";

describe("level files", () => {
  it("round-trips a level through its file", () => {
    const blocks = starterLevel();
    const file = JSON.parse(JSON.stringify(toLevelFile({ name: "Sky castle", goal: "stars", bestTime: 12.5, blocks })));
    expect(file.format).toBe(LEVEL_FORMAT);
    const back = readLevelFile(file)!;
    expect(back.name).toBe("Sky castle");
    expect(back.goal).toBe("stars");
    expect(back.bestTime).toBe(12.5);
    expect(back.blocks.map(({ id: _, ...b }) => b)).toEqual(blocks.map(({ id: _, ...b }) => b));
  });

  it("rejects things that aren't level files", () => {
    expect(readLevelFile(null)).toBeNull();
    expect(readLevelFile({ format: "platformer-toolkit-3d/character", values: {} })).toBeNull();
    expect(readLevelFile({ jumpHeight: 3 })).toBeNull();
  });

  it("drops broken, unknown and overlapping pieces, and fixes bad settings", () => {
    const level = readLevelFile({
      format: LEVEL_FORMAT, name: "  ", goal: "nonsense", bestTime: -3,
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
    expect(level.goal).toBe("flag");
    expect(level.bestTime).toBeNull();
    expect(level.blocks.map((b) => [b.piece, b.x, b.rot])).toEqual([["cube", 0, 0], ["ramp", 4, 1], ["goal", 6, 0]]);
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
    expect(saveLevelToBrowser("a", { name: "One", goal: "flag", bestTime: null, blocks })).toBe(true);
    expect(saveLevelToBrowser("b", { name: "Two", goal: "time", bestTime: null, blocks })).toBe(true);
    expect(saveLevelToBrowser("a", { name: "One again", goal: "flag", bestTime: null, blocks })).toBe(true);
    let list = listSavedLevels();
    expect(list.map((s) => s.name).sort()).toEqual(["One again", "Two"]);
    saveBestTime("b", 9.8);
    expect(readLevelFile(listSavedLevels().find((s) => s.id === "b")!.file)!.bestTime).toBe(9.8);
    deleteSavedLevel("a");
    list = listSavedLevels();
    expect(list.map((s) => s.id)).toEqual(["b"]);
  });
});
