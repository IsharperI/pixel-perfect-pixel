import { describe, it, expect } from "vitest";
import { nextStopOffset, positionAt, readMotion, stopCentres, tripLength, type V3 } from "./motion";

const pts: V3[] = [[0, 0, 0], [3, 0, 0], [3, 3, 0]];
const near = (a: V3, b: V3) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 5));

describe("moving platforms", () => {
  it("goes back and forth, pausing at each stop", () => {
    const m = { speed: 3, wait: 0.5, loop: false };
    // legs: 0→1 (1s), 1→2 (1s), 2→1 (1s), 1→0 (1s), each with a 0.5s wait first
    expect(tripLength(pts, m)).toBeCloseTo(6);
    near(positionAt(pts, m, 0.2), [0, 0, 0]); // waiting at the start
    near(positionAt(pts, m, 1.0), [1.5, 0, 0]); // halfway along the first leg
    near(positionAt(pts, m, 1.6), [3, 0, 0]); // waiting at stop 2
    near(positionAt(pts, m, 3.0), [3, 3, 0]); // waiting at the end
    near(positionAt(pts, m, 4.0), [3, 1.5, 0]); // coming back down
    near(positionAt(pts, m, 6.2), [0, 0, 0]); // round again
  });

  it("loops from the last stop straight back to the first", () => {
    const m = { speed: 3, wait: 0, loop: true };
    const diag = Math.hypot(3, 3) / 3;
    expect(tripLength(pts, m)).toBeCloseTo(2 + diag);
    near(positionAt(pts, m, 2 + diag / 2), [1.5, 1.5, 0]);
  });

  it("stays put with only one stop", () => {
    near(positionAt([[1, 2, 3]], { speed: 3, wait: 0, loop: false }, 5), [1, 2, 3]);
  });

  it("finds stop centres from the block", () => {
    const b = { piece: "cube" as const, x: 0, y: 2, z: 0, rot: 0, move: { stops: [[2, 0, 0]] as V3[], speed: 3, wait: 0, trigger: "always" as const, loop: false } };
    expect(stopCentres(b)).toEqual([[0.5, 2.5, 0.5], [2.5, 2.5, 0.5]]);
  });

  it("puts new stops further along the path", () => {
    expect(nextStopOffset({ stops: [[3, 0, 0]], speed: 3, wait: 0, trigger: "always", loop: false })).toEqual([6, 0, 0]);
    expect(nextStopOffset({ stops: [[0, 2, 0], [0, 2, 4]], speed: 3, wait: 0, trigger: "always", loop: false })).toEqual([0, 2, 8]);
  });

  it("reads motion from files safely", () => {
    expect(readMotion({ stops: [] })).toBeUndefined();
    expect(readMotion({ stops: [[1, 0, 0], [0.5, 0, 0], "x"], speed: 99, trigger: "step", loop: true })).toEqual({
      stops: [[1, 0, 0]], speed: 10, wait: 0.5, trigger: "step", loop: true,
    });
  });
});
