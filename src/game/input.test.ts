import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { input, readMove, useInputListeners } from "./input";

const key = (type: "keydown" | "keyup", code: string, extra: KeyboardEventInit = {}) =>
  window.dispatchEvent(new KeyboardEvent(type, { code, key: code === "MetaLeft" ? "Meta" : code, ...extra }));

describe("held keys never get stuck", () => {
  it("lets go of keys when the game goes away (e.g. switching pages)", () => {
    const { unmount } = renderHook(() => useInputListeners());
    key("keydown", "KeyW");
    expect(readMove().y).toBe(1);
    unmount(); // W is let go on the other page, where nothing hears it
    expect(input.keys.size).toBe(0);
  });
  it("starts fresh when a game appears", () => {
    input.keys.add("KeyD"); // left over from before
    const { unmount } = renderHook(() => useInputListeners());
    expect(readMove().x).toBe(0);
    unmount();
  });
  it("lets go when the window loses focus or the tab is hidden", () => {
    const { unmount } = renderHook(() => useInputListeners());
    key("keydown", "KeyA");
    window.dispatchEvent(new Event("blur"));
    expect(input.keys.size).toBe(0);
    key("keydown", "KeyA");
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(input.keys.size).toBe(0);
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    unmount();
  });
  it("ignores shortcut combos and lets go when ⌘ is released (Mac)", () => {
    const { unmount } = renderHook(() => useInputListeners());
    key("keydown", "KeyS", { metaKey: true });
    expect(input.keys.size).toBe(0);
    key("keydown", "KeyD");
    key("keyup", "MetaLeft");
    expect(input.keys.size).toBe(0);
    unmount();
  });
});
