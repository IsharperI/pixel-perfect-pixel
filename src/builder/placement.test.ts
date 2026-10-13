import { describe, it, expect } from "vitest";
import { placementFor } from "./placement";
import type { Block } from "./pieces";

const cube = (x: number, y: number, z: number): Block => ({ id: "c", piece: "cube", x, y, z, rot: 0 });
const up = { x: 0, y: 1, z: 0 };

describe("placement", () => {
  it("puts blocks on the ground under the pointer", () => {
    expect(placementFor(null, { x: 3.4, y: 0, z: -1.2 }, up, "cube", 0)).toEqual({ x: 3, y: 0, z: -2 });
  });
  it("stacks on top of a block", () => {
    expect(placementFor(cube(2, 1, 2), { x: 2.5, y: 2, z: 2.5 }, up, "cube", 0)).toEqual({ x: 2, y: 2, z: 2 });
  });
  it("attaches to each side of a block", () => {
    const c = cube(0, 0, 0);
    expect(placementFor(c, { x: 1, y: 0.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, "cube", 0)).toEqual({ x: 1, y: 0, z: 0 });
    expect(placementFor(c, { x: 0, y: 0.5, z: 0.5 }, { x: -1, y: 0, z: 0 }, "cube", 0)).toEqual({ x: -1, y: 0, z: 0 });
    expect(placementFor(c, { x: 0.5, y: 0.5, z: 1 }, { x: 0, y: 0, z: 1 }, "cube", 0)).toEqual({ x: 0, y: 0, z: 1 });
    expect(placementFor(c, { x: 0.5, y: 0.5, z: 0 }, { x: 0, y: 0, z: -1 }, "cube", 0)).toEqual({ x: 0, y: 0, z: -1 });
  });
  it("hangs a block underneath a floating one", () => {
    expect(placementFor(cube(0, 3, 0), { x: 0.5, y: 3, z: 0.5 }, { x: 0, y: -1, z: 0 }, "cube", 0)).toEqual({ x: 0, y: 2, z: 0 });
  });
  it("extends wide pieces away from the face they attach to", () => {
    // A 2x2 attached to the -x side of a cube must end at x = -1, i.e. start at x = -2
    expect(placementFor(cube(0, 0, 0), { x: 0, y: 0.5, z: 0.5 }, { x: -1, y: 0, z: 0 }, "wide", 0)).toEqual({ x: -2, y: 0, z: 0 });
    // A plank (3 long in x) on the ground is centred under the pointer
    expect(placementFor(null, { x: 5.5, y: 0, z: 0.5 }, up, "plank", 0)).toEqual({ x: 4, y: 0, z: 0 });
  });
  it("sits on the sloped face of a ramp", () => {
    const ramp: Block = { id: "r", piece: "ramp", x: 0, y: 0, z: 0, rot: 0 };
    expect(placementFor(ramp, { x: 0.5, y: 0.5, z: 1.2 }, { x: 0, y: 0.89, z: -0.45 }, "cube", 0)).toEqual({ x: 0, y: 1, z: 1 });
  });
});
