import { describe, it, expect } from "vitest";
import { STEPS } from "./tutorial";
import { SETTINGS } from "./settings";

describe("tutorial steps", () => {
  it("only highlight settings that exist", () => {
    for (const step of STEPS) {
      for (const key of step.highlight ?? []) {
        expect(SETTINGS.some((s) => s.key === key), `${step.title}: unknown highlight "${key}"`).toBe(true);
      }
    }
  });

  it("only set up real settings, with valid values", () => {
    for (const step of STEPS) {
      for (const [key, v] of Object.entries(step.setup ?? {})) {
        const def = SETTINGS.find((s) => s.key === key);
        expect(def, `${step.title}: unknown setup key "${key}"`).toBeDefined();
        expect(typeof v).toBe(def!.kind === "choice" ? "string" : def!.kind);
        if (def!.kind === "number") {
          expect(v as number).toBeGreaterThanOrEqual(def!.min!);
          expect(v as number).toBeLessThanOrEqual(def!.max!);
        }
        if (def!.kind === "choice") expect(def!.options!.map((o) => o.value)).toContain(v);
      }
    }
  });

  it("have text on every step and end with a step that needs no task", () => {
    for (const step of STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
    }
    expect(STEPS[STEPS.length - 1]!.done).toBeUndefined();
  });
});
