import { describe, it, expect } from "vitest";
import { bounceSpeed, padUnder, squish, type Pad } from "./bounce";

const pad: Pad = { id: "p", x: 0.5, z: 0.5, top: 0.5, hx: 0.46, hz: 0.46, height: 4, boingAt: -1 };

describe("bounce pads", () => {
  it("knows when you're standing on one", () => {
    expect(padUnder(0.5, 0.5, 0.5, [pad])).toBe(pad);
    expect(padUnder(1.05, 0.52, 0.5, [pad])).toBe(pad); // near the edge still counts
    expect(padUnder(2, 0.5, 0.5, [pad])).toBeNull();
    expect(padUnder(0.5, 1.2, 0.5, [pad])).toBeNull(); // in the air above it
  });

  it("launches you high enough, higher if you hold jump", () => {
    const g = 30;
    const v = bounceSpeed(4, g, false);
    expect((v * v) / (2 * g)).toBeCloseTo(4); // rises exactly 4 blocks
    expect(bounceSpeed(4, g, true)).toBeGreaterThan(v);
  });

  it("squishes then settles", () => {
    expect(squish(0)).toBeGreaterThan(0.5);
    expect(squish(1)).toBe(0);
    expect(squish(-1)).toBe(0);
  });
});
