import { describe, expect, it } from "vitest";
import { codeFromHash, decodeLevel, encodeLevel, shareLink } from "./shareLink";
import { DEFAULT_RULES } from "./rules";
import { starterLevel, type Block } from "./pieces";

describe("share links", () => {
  it("round-trip a level through a link", async () => {
    const blocks: Block[] = [
      ...starterLevel(),
      { id: "m", piece: "cube", x: 9, y: 2, z: 9, rot: 0, move: { stops: [[2, 0, 0]], speed: 2, wait: 0.5, trigger: "always", loop: false } },
      { id: "h", piece: "star", x: 9, y: 4, z: 7, rot: 0, homing: true },
    ];
    const level = { name: "Shared one", rules: { ...DEFAULT_RULES, stars: true, clock: "trial" as const }, bestTime: 12.3, blocks };
    const link = await shareLink(level, "https://example.com/builder");
    const code = codeFromHash(new URL(link).hash);
    expect(code).toBeTruthy();
    const back = await decodeLevel(code!);
    expect(back?.name).toBe("Shared one");
    expect(back?.rules.clock).toBe("trial");
    expect(back?.bestTime).toBeNull(); // your record isn't shared
    expect(back?.blocks.map(({ id: _, ...b }) => b)).toEqual(blocks.map(({ id: _, ...b }) => b));
  });
  it("keeps links reasonably short", async () => {
    const blocks: Block[] = [];
    for (let x = 0; x < 20; x++) for (let z = 0; z < 15; z++) blocks.push({ id: `${x}-${z}`, piece: "cube", x, y: 0, z, rot: 0 });
    const code = await encodeLevel({ name: "Floor", rules: DEFAULT_RULES, bestTime: null, blocks });
    expect(code.length).toBeLessThan(1500); // 300 blocks
  });
  it("rejects broken links", async () => {
    expect(await decodeLevel("not-a-real-code")).toBeNull();
    expect(codeFromHash("#something-else")).toBeNull();
  });
});
