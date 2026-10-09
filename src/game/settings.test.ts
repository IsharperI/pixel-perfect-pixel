import { describe, it, expect } from "vitest";
import { deriveJump, defaultValues } from "./settings";

describe("jump derivation", () => {
  it("gravity = 2h/t² and jump velocity = g*t for defaults (3, 0.4)", () => {
    const { gravity, jumpVelocity } = deriveJump(3, 0.4);
    expect(gravity).toBeCloseTo(37.5);
    expect(jumpVelocity).toBeCloseTo(15);
  });
});

describe("defaults", () => {
  it("match the spec", () => {
    const d = defaultValues();
    expect(d.maxSpeed).toBe(8);
    expect(d.acceleration).toBe(40);
    expect(d.deceleration).toBe(50);
    expect(d.fallGravityMultiplier).toBe(1.8);
    expect(d.coyoteTime).toBe(0.1);
    expect(d.cameraDistance).toBe(8);
  });
});
