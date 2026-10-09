import { describe, it, expect } from "vitest";
import { deriveJump, defaultValues, SETTINGS, PRESETS, presetValues, matchingPreset } from "./settings";

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
    expect(d['maxSpeed']).toBe(8);
    expect(d['acceleration']).toBe(40);
    expect(d['deceleration']).toBe(50);
    expect(d['fallGravityMultiplier']).toBe(1.8);
    expect(d['coyoteTime']).toBe(0.1);
    expect(d['cameraDistance']).toBe(8);
  });
});

describe("presets", () => {
  it("only use real setting keys, with values of the right type inside each slider's range", () => {
    for (const p of PRESETS) {
      for (const [k, v] of Object.entries(p.values)) {
        const def = SETTINGS.find((s) => s.key === k);
        expect(def, `${p.name}: unknown key ${k}`).toBeDefined();
        expect(typeof v).toBe(def!.kind);
        if (def!.kind === "number") {
          expect(v as number).toBeGreaterThanOrEqual(def!.min!);
          expect(v as number).toBeLessThanOrEqual(def!.max!);
        }
      }
    }
  });
  it("are recognised as active when applied, and defaults match the Default preset", () => {
    expect(matchingPreset(defaultValues())).toBe("Default");
    for (const p of PRESETS) expect(matchingPreset(presetValues(p))).toBe(p.name);
  });
  it("report Custom (null) once a value is tweaked", () => {
    expect(matchingPreset({ ...defaultValues(), maxSpeed: 12.5 })).toBeNull();
  });
});
