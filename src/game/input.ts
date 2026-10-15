import { useEffect } from "react";
import { useUI } from "./settings";

export const input = {
  keys: new Set<string>(),
  jumpPressedAt: -Infinity, // performance.now() seconds of last jump press
  crouchPressedAt: -Infinity, // same, for the crouch button (ground pound trigger)
  grabPressedAt: -Infinity, // same, for the grab button (E): grab onto / let go of vines
  orbitDX: 0,
  orbitDY: 0,
  lastOrbitAt: -Infinity,
  // On-screen touch controls (see TouchControls.tsx). Stick is -1..1, +y = forward.
  touch: { x: 0, y: 0, jumpHeld: false, crouchHeld: false },
  running: true, // keyboard: run by default; tap Z to toggle walking
};


/**
 * Let go of every key. Used whenever we might miss a key being released: the
 * window losing focus, switching tabs or pages, or the game going away (a key
 * let go while nothing is listening would otherwise stay "held" forever).
 */
export function releaseAllKeys() {
  input.keys.clear();
  resetTouch();
}

/** Let go of everything the touch controls are holding. */
export function resetTouch() {
  input.touch.x = 0;
  input.touch.y = 0;
  input.touch.jumpHeld = false;
  input.touch.crouchHeld = false;
}

const MOVE = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "ShiftLeft", "ShiftRight"];

export function readMove() {
  const k = input.keys;
  let x = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
  let y = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
  const keyboardMoving = x !== 0 || y !== 0;
  let jumpHeld = k.has("Space") || input.touch.jumpHeld;
  let crouchHeld = k.has("ShiftLeft") || k.has("ShiftRight") || input.touch.crouchHeld;
  x += input.touch.x;
  y += input.touch.y;
  let camX = 0, camY = 0;
  const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) {
    if (!p) continue;
    const dz = (v: number) => (Math.abs(v) < 0.15 ? 0 : v);
    x += dz(p.axes[0] ?? 0);
    y -= dz(p.axes[1] ?? 0);
    camX += dz(p.axes[2] ?? 0);
    camY += dz(p.axes[3] ?? 0);
    const b = p.buttons[0]?.pressed ?? false;
    if (b && !padJumpWas) input.jumpPressedAt = performance.now() / 1000;
    padJumpWas = b;
    jumpHeld ||= b;
    // Crouch: B button or left trigger
    const cr = (p.buttons[1]?.pressed ?? false) || (p.buttons[6]?.pressed ?? false);
    if (cr && !padCrouchWas) input.crouchPressedAt = performance.now() / 1000;
    padCrouchWas = cr;
    // Grab: X button
    const gr = p.buttons[2]?.pressed ?? false;
    if (gr && !padGrabWas) input.grabPressedAt = performance.now() / 1000;
    padGrabWas = gr;
    crouchHeld ||= cr;
    break;
  }
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  // Analog = a stick (touch or gamepad) is doing the moving, so how far it's pushed matters
  const analog = !keyboardMoving && (x !== 0 || y !== 0);
  return { x, y, jumpHeld, crouchHeld, camX, camY, analog };
}
let padJumpWas = false;
let padCrouchWas = false;
let padGrabWas = false;

export function useInputListeners() {
  useEffect(() => {
    releaseAllKeys(); // anything "held" from before this game appeared is stale
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" && (el as HTMLInputElement).type !== "range" && (el as HTMLInputElement).type !== "checkbox" || el.tagName === "TEXTAREA");
    };
    const down = (e: KeyboardEvent) => {
      if (isTyping()) return;
      // Using a keyboard: hide the on-screen touch controls
      if (useUI.getState().touchMode) { useUI.getState().setTouchMode(false); resetTouch(); }
      // Run toggle: tap Z (ignore browser shortcuts like Ctrl+Z)
      if (e.code === "KeyZ" && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
        input.running = !input.running;
        return;
      }
      if (e.code === "KeyT" && !e.repeat) { useUI.getState().showOrToggle("panelOpen"); return; }
      if (e.code === "KeyE" && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) { input.grabPressedAt = performance.now() / 1000; return; }
      // Browser shortcuts (Ctrl/⌘ + a key) aren't moves; and on a Mac, keys let go while ⌘ is
      // held never report it, so don't start holding them
      if (e.ctrlKey || e.metaKey) return;
      if (MOVE.includes(e.code)) {
        // keep sliders from eating game keys
        (document.activeElement as HTMLElement | null)?.blur?.();
        e.preventDefault();
        if (e.code === "Space" && !e.repeat) input.jumpPressedAt = performance.now() / 1000;
        if ((e.code === "ShiftLeft" || e.code === "ShiftRight") && !e.repeat) input.crouchPressedAt = performance.now() / 1000;
        input.keys.add(e.code);
      }
    };
    const up = (e: KeyboardEvent) => {
      input.keys.delete(e.code);
      if (e.key === "Meta") releaseAllKeys(); // see above: a Mac may have swallowed other keys' release
    };
    const blur = () => releaseAllKeys();
    const hidden = () => { if (document.hidden) releaseAllKeys(); };
    // First touch anywhere: show the on-screen controls
    const touchStart = (e: PointerEvent) => {
      if (e.pointerType === "touch" && !useUI.getState().touchMode) useUI.getState().setTouchMode(true);
    };
    window.addEventListener("pointerdown", touchStart, true);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      releaseAllKeys(); // leaving: we won't hear these keys being let go
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pointerdown", touchStart, true);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
}
