import { describe, it, expect, beforeEach } from "vitest";
import { useLevel } from "./levelStore";
import { DEFAULT_RULES } from "./rules";

const S = () => useLevel.getState();

describe("level editor store", () => {
  beforeEach(() => useLevel.setState({ blocks: [], past: [], future: [], selectedId: null, tool: "build", rot: 0 }));

  it("places blocks, refuses overlaps, and undoes/redoes", () => {
    expect(S().place({ piece: "cube", x: 0, y: 0, z: 0, rot: 0 })).toBe(true);
    expect(S().place({ piece: "cube", x: 0, y: 0, z: 0, rot: 0 })).toBe(false);
    expect(S().place({ piece: "cube", x: 0, y: 1, z: 0, rot: 0 })).toBe(true);
    expect(S().blocks).toHaveLength(2);
    S().undo();
    expect(S().blocks).toHaveLength(1);
    S().redo();
    expect(S().blocks).toHaveLength(2);
  });

  it("places and removes many blocks as a single undo step", () => {
    S().place({ piece: "cube", x: 1, y: 0, z: 0, rot: 0 });
    const n = S().placeMany([0, 1, 2].map((x) => ({ piece: "cube" as const, x, y: 0, z: 0, rot: 0 })));
    expect(n).toBe(2); // x=1 was already taken
    expect(S().blocks).toHaveLength(3);
    S().undo();
    expect(S().blocks).toHaveLength(1);
    S().redo();
    S().removeMany(S().blocks.map((b) => b.id));
    expect(S().blocks).toHaveLength(0);
    S().undo();
    expect(S().blocks).toHaveLength(3);
  });

  it("clears the level down to a Start pad, and can undo it", () => {
    S().place({ piece: "cube", x: 3, y: 0, z: 0, rot: 0 });
    S().place({ piece: "star", x: 3, y: 1, z: 0, rot: 0 });
    S().clearLevel();
    expect(S().blocks.map((b) => b.piece)).toEqual(["start"]);
    S().undo();
    expect(S().blocks).toHaveLength(2);
  });

  it("clears the best time when the challenge changes", () => {
    S().setRules({ clock: "trial" });
    S().setBestTime(12);
    S().setRules({ limit: 30 }); // doesn't change the challenge for a time trial
    expect(S().bestTime).toBe(12);
    S().setRules({ stars: !S().rules.stars });
    expect(S().bestTime).toBeNull();
  });

  it("makes a block move, adds/moves/removes stops, and undoes", () => {
    S().place({ piece: "cube", x: 0, y: 2, z: 0, rot: 0 });
    const id = S().blocks[0]!.id;
    S().addStop(id); // first "add stop" makes it move, with one stop
    expect(S().blocks[0]!.move!.stops).toEqual([[3, 0, 0]]);
    S().addStop(id);
    expect(S().blocks[0]!.move!.stops).toEqual([[3, 0, 0], [6, 0, 0]]);
    expect(S().stopIndex).toBe(2);
    expect(S().moveStop(id, 2, [3, 4, 0])).toBe(true);
    expect(S().moveStop(id, 2, [0, -5, 0])).toBe(false); // below the water
    S().updateMotion(id, { loop: true, trigger: "step" });
    expect(S().blocks[0]!.move).toMatchObject({ loop: true, trigger: "step", stops: [[3, 0, 0], [3, 4, 0]] });
    S().removeStop(id, 1);
    expect(S().blocks[0]!.move!.stops).toEqual([[3, 4, 0]]);
    S().removeStop(id, 1); // last stop gone: it stops moving
    expect(S().blocks[0]!.move).toBeUndefined();
    S().undo();
    expect(S().blocks[0]!.move!.stops).toEqual([[3, 4, 0]]);
  });

  it("makes a block tilt, and a platform either moves or tilts", () => {
    S().place({ piece: "plank", x: 0, y: 2, z: 0, rot: 0 });
    const id = S().blocks[0]!.id;
    S().setTilt(id, true);
    expect(S().blocks[0]!.tilt).toEqual({ max: 22 });
    S().setTiltMax(id, 61);
    expect(S().blocks[0]!.tilt).toEqual({ max: 61 });
    S().setTiltMax(id, 400);
    expect(S().blocks[0]!.tilt).toEqual({ max: 75 });
    S().addStop(id); // making it move stops it tilting
    expect(S().blocks[0]!.tilt).toBeUndefined();
    expect(S().blocks[0]!.move).toBeDefined();
    S().setTilt(id, true); // and the other way round
    expect(S().blocks[0]!.move).toBeUndefined();
    S().setTilt(id, false);
    expect(S().blocks[0]!.tilt).toBeUndefined();
    S().undo();
    expect(S().blocks[0]!.tilt).toEqual({ max: 22 });
  });

  it("only lets plain blocks move", () => {
    S().place({ piece: "ramp", x: 0, y: 0, z: 0, rot: 0 });
    S().setMotion(S().blocks[0]!.id, { stops: [[1, 0, 0]], speed: 3, wait: 0, trigger: "always", loop: false });
    expect(S().blocks[0]!.move).toBeUndefined();
  });

  it("keeps only one Start pad", () => {
    S().place({ piece: "start", x: 0, y: 0, z: 0, rot: 0 });
    S().place({ piece: "start", x: 5, y: 0, z: 5, rot: 0 });
    const starts = S().blocks.filter((b) => b.piece === "start");
    expect(starts).toHaveLength(1);
    expect(starts[0]!.x).toBe(5);
  });

  it("moves blocks only to free spots", () => {
    S().place({ piece: "cube", x: 0, y: 0, z: 0, rot: 0 });
    S().place({ piece: "cube", x: 2, y: 0, z: 0, rot: 0 });
    const [a] = S().blocks;
    expect(S().move(a!.id, { x: 2, y: 0, z: 0 })).toBe(false);
    expect(S().move(a!.id, { x: 0, y: 4, z: 0 })).toBe(true); // float it
    expect(S().blocks.find((b) => b.id === a!.id)!.y).toBe(4);
  });

  it("rotates the selected block, or the next block when building", () => {
    S().place({ piece: "plank", x: 0, y: 0, z: 0, rot: 0 });
    const id = S().blocks[0]!.id;
    useLevel.setState({ tool: "select", selectedId: id });
    S().rotate();
    expect(S().blocks[0]!.rot).toBe(1);
    useLevel.setState({ tool: "build", selectedId: null });
    S().rotate();
    expect(S().rot).toBe(1);
  });

  it("erasing a selected block clears the selection", () => {
    S().place({ piece: "cube", x: 0, y: 0, z: 0, rot: 0 });
    const id = S().blocks[0]!.id;
    S().select(id);
    S().remove(id);
    expect(S().blocks).toHaveLength(0);
    expect(S().selectedId).toBeNull();
  });
});

describe("copying a block", () => {
  it("puts a copy beside it, selects it, and keeps its settings", () => {
    const L = useLevel.getState();
    L.loadLevel({ name: "t", rules: DEFAULT_RULES, bestTime: null, blocks: [
      { id: "s", piece: "start", x: 0, y: 0, z: 0, rot: 0 },
      { id: "p", piece: "bounce", x: 3, y: 0, z: 3, rot: 1, bounce: 7 },
    ] });
    expect(useLevel.getState().duplicate("p")).toBe(true);
    const S = useLevel.getState();
    const copy = S.blocks.find((b) => b.id === S.selectedId)!;
    expect(copy.id).not.toBe("p");
    expect([copy.piece, copy.rot, copy.bounce, copy.y]).toEqual(["bounce", 1, 7, 0]);
    expect(Math.abs(copy.x - 3) + Math.abs(copy.z - 3)).toBe(1);
    expect(useLevel.getState().duplicate("s")).toBe(false); // only one Start
  });
});
