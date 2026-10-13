import { useEffect } from "react";
import { useUI } from "./settings";

export const input = {
  keys: new Set<string>(),
  jumpPressedAt: -Infinity, // performance.now() seconds of last jump press
  crouchPressedAt: -Infinity, // same, for the crouch button (ground pound trigger)
  orbitDX: 0,
  orbitDY: 0,
  lastOrbitAt: -Infinity,
  // On-screen touch controls (see TouchControls.tsx). Stick is -1..1, +y = forward.
  touch: { x: 0, y: 0, jumpHeld: false, crouchHeld: false },
  running: false, // run toggle (keyboard: tap Ctrl)
};

let ctrlDown = false;
let ctrlCleanTap = false; // true while Ctrl is down and no other key has been pressed with it

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

export function useInputListeners() {
  useEffect(() => {
    const isTyping = () => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" && (el as HTMLInputElement).type !== "range" && (el as HTMLInputElement).type !== "checkbox" || el.tagName === "TEXTAREA");
    };
    const down = (e: KeyboardEvent) => {
      if (isTyping()) return;
      // Using a keyboard: hide the on-screen touch controls
      if (useUI.getState().touchMode) { useUI.getState().setTouchMode(false); resetTouch(); }
      // Run toggle: counts only as a clean tap of Ctrl on its own (toggled on release)
      if (e.code === "ControlLeft" || e.code === "ControlRight") {
        if (!e.repeat) { ctrlDown = true; ctrlCleanTap = true; }
        return;
      }
      if (ctrlDown) ctrlCleanTap = false;
      // Stop the browser shortcuts a page is allowed to block (bookmark, save, select all).
      // Ctrl+W (close tab) can't be blocked by any web page.
      if (e.ctrlKey && (e.code === "KeyD" || e.code === "KeyS" || e.code === "KeyA")) e.preventDefault();
      if (e.code === "KeyT" && !e.repeat) { useUI.getState().toggle("panelOpen"); return; }
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
      if (e.code === "ControlLeft" || e.code === "ControlRight") {
        if (ctrlDown && ctrlCleanTap && !isTyping()) input.running = !input.running;
        ctrlDown = false;
        ctrlCleanTap = false;
      }
      input.keys.delete(e.code);
    };
    const blur = () => { input.keys.clear(); resetTouch(); ctrlDown = false; ctrlCleanTap = false; };
    // First touch anywhere: show the on-screen controls
    const touchStart = (e: PointerEvent) => {
      if (e.pointerType === "touch" && !useUI.getState().touchMode) useUI.getState().setTouchMode(true);
    };
    window.addEventListener("pointerdown", touchStart, true);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("pointerdown", touchStart, true);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
}
