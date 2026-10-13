import { describe, it, expect } from "vitest";
import { FACE, boxFaces, faceCoords, findGrab, rotateFaces, vineAt, wallTop } from "./climb";

// A 1x3x1 tower of three cubes (x 0..1, z 0..1, y 0..3), vines on its +x side
const wall = [0, 1, 2].flatMap((y) => boxFaces([0, y, 0], [1, y + 1, 1], FACE.px));

describe("climbing", () => {
  it("finds the vine face in front of the player", () => {
    expect(findGrab(1.5, 1.5, 0.5, wall)!.nx).toBe(1);
    expect(findGrab(2.5, 1.5, 0.5, wall)).toBeNull(); // too far
    expect(findGrab(-0.5, 1.5, 0.5, wall)).toBeNull(); // the other side has no vines
    expect(findGrab(1.5, 1.5, 3, wall)).toBeNull(); // off to the side
  });

  it("joins faces into one wall to climb up", () => {
    const f = wall[0]!;
    expect(vineAt(f, 0.5, 2.5, wall)).toBe(true); // on the third cube
    expect(vineAt(f, 0.5, 3.2, wall)).toBe(false); // above the top
    expect(vineAt(f, 1.4, 1, wall)).toBe(false); // past the side
    expect(wallTop(f, 0.5, 2.5, wall)).toBe(3);
  });

  it("measures distance in front of a face and position along it", () => {
    const f = boxFaces([0, 0, 0], [2, 1, 1], FACE.nz)[0]!; // facing -z at z=0
    expect(faceCoords(f, 1.5, -0.4)).toEqual({ dist: 0.4, t: 1.5 });
  });

  it("turns a block's faces with the block", () => {
    expect(rotateFaces(FACE.px, 0)).toBe(FACE.px);
    expect(rotateFaces(FACE.px, 1)).toBe(FACE.nz);
    expect(rotateFaces(FACE.px | FACE.pz, 1)).toBe(FACE.nz | FACE.px);
    expect(rotateFaces(FACE.px, 4)).toBe(FACE.px);
  });
});
