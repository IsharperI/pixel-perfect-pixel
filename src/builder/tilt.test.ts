import { describe, it, expect } from "vitest";
import { MAX_TILT, approach, tiltAxes, tiltTarget, toLocal } from "./tilt";
import { topAt, type Carrier } from "../game/carriers";

describe("tilting platforms", () => {
  it("planks tip end to end; square pieces tip any way", () => {
    expect(tiltAxes("plank")).toEqual({ aboutX: false, aboutZ: true });
    expect(tiltAxes("wide")).toEqual({ aboutX: true, aboutZ: true });
  });

  it("tips toward where you stand, more at the ends", () => {
    expect(tiltTarget("plank", 0, 0)).toEqual([0, -0]);
    const [, z] = tiltTarget("plank", 1.5, 0.4); // standing on the +x end
    expect(z).toBeCloseTo(-MAX_TILT);
    expect(tiltTarget("plank", 0.75, 0)[1]).toBeCloseTo(-MAX_TILT / 2);
    expect(tiltTarget("wide", 0, -1)[0]).toBeCloseTo(-MAX_TILT);
    expect(tiltTarget("wide", 5, 5)).toEqual([MAX_TILT, -MAX_TILT]); // capped
  });

  it("turns world offsets into the platform's own frame", () => {
    const [a, b] = toLocal(1, 0, 1); // a quarter turn
    expect(a).toBeCloseTo(0); expect(Math.abs(b)).toBeCloseTo(1);
    expect(toLocal(2, 3, 0)).toEqual([2, 3]);
  });

  it("eases toward the target", () => {
    expect(approach(0, 1, 2.5, 0)).toBe(0);
    expect(approach(0, 1, 2.5, 10)).toBeCloseTo(1);
  });

  it("works out the height of a tilted top", () => {
    const flat = { x: 0, y: 1, z: 0, hy: 0.5, nx: 0, ny: 1, nz: 0 } as Carrier;
    expect(topAt(flat, 3, 3)).toBe(1.5);
    const t = Math.PI / 8; // tipped so it faces toward +x: +x side lower
    const tipped = { ...flat, nx: Math.sin(t), ny: Math.cos(t) } as Carrier;
    expect(topAt(tipped, 1, 0)).toBeLessThan(topAt(tipped, -1, 0));
    expect(topAt(tipped, 0, 0)).toBeCloseTo(1 + 0.5 / Math.cos(t));
  });
});
