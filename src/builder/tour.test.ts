import { describe, it, expect } from "vitest";
import { TOUR, type TourState } from "./tour";
import type { Block } from "./pieces";

const b = (id: string, piece: Block["piece"], y = 0, extra: Partial<Block> = {}): Block => ({ id, piece, x: 0, y, z: 0, rot: 0, ...extra });
const st = (blocks: Block[], extra: Partial<TourState> = {}): TourState => ({ blocks, panelOpen: false, mode: "edit", levelId: "x", ...extra });
const step = (title: string) => TOUR.find((s) => s.title === title)!;

describe("level builder tour", () => {
  it("has a read-only last step and every step has words", () => {
    expect(TOUR.at(-1)!.done).toBeUndefined();
    for (const s of TOUR) { expect(s.title.length).toBeGreaterThan(0); expect(s.body.length).toBeGreaterThan(20); }
  });

  it("spots each thing you're asked to do", () => {
    const start = st([b("a", "cube")]);
    expect(step("Add a block").done!(st([b("a", "cube"), b("n", "cube")]), start)).toBe(true);
    expect(step("Add a block").done!(start, start)).toBe(false);
    expect(step("Fill an area").done!(st([b("a", "cube"), ...["1", "2", "3"].map((i) => b(i, "cube"))]), start)).toBe(false);
    expect(step("Make it float").done!(st([b("a", "cube", 2)]), start)).toBe(true);
    expect(step("Moving and tilting").done!(st([b("a", "cube", 0, { tilt: { max: 22 } })]), start)).toBe(true);
    expect(step("Climbing vines").done!(st([b("a", "cube", 0, { vines: 4 })]), start)).toBe(true);
    expect(step("Bounce pads").done!(st([b("a", "cube"), b("p", "bounce")]), start)).toBe(true);
    expect(step("Start, goal and stars").done!(st([], { panelOpen: true }), start)).toBe(true);
    expect(step("Play it!").done!(st([], { mode: "play" }), start)).toBe(true);
  });
});
