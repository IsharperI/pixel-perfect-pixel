import { describe, it, expect, beforeEach } from "vitest";
import { useLevel } from "./levelStore";

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
