import { describe, it, expect } from "vitest";
import { toCharacterFile, readCharacterFile, CHARACTER_FORMAT, CHARACTER_VERSION } from "./characterFile";
import { defaultValues } from "./settings";

describe("character files", () => {
  it("round-trip: what we write, we can read back", () => {
    const values = { ...defaultValues(), maxSpeed: 22 };
    const file = JSON.parse(JSON.stringify(toCharacterFile(values)));
    expect(file.format).toBe(CHARACTER_FORMAT);
    expect(file.version).toBe(CHARACTER_VERSION);
    expect(readCharacterFile(file)).toEqual(values);
  });

  it("still read old exports (a bare settings object)", () => {
    expect(readCharacterFile({ maxSpeed: 12, dust: false })).toEqual({ maxSpeed: 12, dust: false });
  });

  it("reject things that aren't character files", () => {
    expect(readCharacterFile(null)).toBeNull();
    expect(readCharacterFile([1, 2, 3])).toBeNull();
    expect(readCharacterFile("hello")).toBeNull();
    expect(readCharacterFile({ format: "some-other-app", values: {} })).toBeNull();
    expect(readCharacterFile({ format: CHARACTER_FORMAT, values: "nope" })).toBeNull();
  });
});
