import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronsDown, Hand } from "lucide-react";
import { input, resetTouch } from "./input";
import { liveStats, useSettings, useUI } from "./settings";
import { usePhone } from "./usePhone";

const STICK_RADIUS = 60; // px the knob can travel from the centre
const DEAD_ZONE = 0.12; // ignore tiny thumb wobbles
const LOOK_SPEED = 1.3; // camera drag sensitivity, relative to mouse dragging

/**
 * On-screen controls for touchscreens. Shown after the first touch, hidden on
 * any key press. Left half: a floating thumbstick that appears where the thumb
 * lands. Right half: swipe to look around. Bottom-right: Jump and Crouch.
 * Feeds the same `input` object as the keyboard and gamepad.
 */
export function TouchControls({ panelOpen: panelOverride }: { panelOpen?: boolean } = {}) {
  const touchMode = useUI((s) => s.touchMode);
  const settingsOpen = useUI((s) => s.panelOpen && !s.hideUI);
  const panelOpen = panelOverride ?? settingsOpen;
  const climbing = useSettings((s) => s.values["climbing"] === true);
  const phone = usePhone();
  // Grab only shows when you're next to vines (or on them)
  const [canGrab, setCanGrab] = useState(false);
  useEffect(() => {
    if (!touchMode || !climbing) return;
    const id = setInterval(() => setCanGrab(liveStats.canGrab), 120);
    return () => clearInterval(id);
  }, [touchMode, climbing]);
  const layer = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const stick = useRef<{ id: number; ox: number; oy: number } | null>(null);
  const look = useRef<{ id: number; x: number; y: number } | null>(null);

  // Let go of everything when the controls hide or the page changes
  useEffect(() => {
    if (!touchMode) { stick.current = null; look.current = null; resetTouch(); }
    return () => resetTouch();
  }, [touchMode]);

  if (!touchMode) return null;
  // Phones: the Character page's bottom drawer takes the controls' place while it's open
  if (phone && panelOverride === undefined && settingsOpen) return null;

  const local = (e: React.PointerEvent) => {
    const r = layer.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width };
  };
  const placeStick = (active: boolean, x?: number, y?: number) => {
    const b = base.current, k = knob.current;
    if (!b || !k) return;
    b.dataset["active"] = String(active);
    if (active && x !== undefined && y !== undefined) {
      b.style.left = `${x}px`;
      b.style.top = `${y}px`;
      b.style.bottom = "";
    } else {
      // Resting hint in the bottom-left
      b.style.left = "";
      b.style.top = "";
      b.style.bottom = "";
    }
    k.style.transform = "translate(-50%, -50%)";
  };

  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const p = local(e);
    if (p.x < p.w / 2) {
      if (stick.current) return; // one thumb on the stick at a time
      stick.current = { id: e.pointerId, ox: p.x, oy: p.y };
      placeStick(true, p.x, p.y);
    } else {
      if (look.current) return;
      look.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }
    layer.current?.setPointerCapture(e.pointerId);
  };

  const onMove = (e: React.PointerEvent) => {
    const s = stick.current;
    if (s && e.pointerId === s.id) {
      const p = local(e);
      let dx = p.x - s.ox, dy = p.y - s.oy;
      const len = Math.hypot(dx, dy);
      if (len > STICK_RADIUS) { dx *= STICK_RADIUS / len; dy *= STICK_RADIUS / len; }
      if (knob.current) knob.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      // Analog: push further to go faster, with a small dead zone in the middle
      const m = Math.min(len / STICK_RADIUS, 1);
      const scaled = m < DEAD_ZONE ? 0 : (m - DEAD_ZONE) / (1 - DEAD_ZONE);
      const nx = len > 0 ? dx / Math.min(len, STICK_RADIUS) : 0;
      const ny = len > 0 ? dy / Math.min(len, STICK_RADIUS) : 0;
      input.touch.x = nx * scaled;
      input.touch.y = -ny * scaled; // screen up = forward
      return;
    }
    const l = look.current;
    if (l && e.pointerId === l.id) {
      input.orbitDX += (e.clientX - l.x) * LOOK_SPEED;
      input.orbitDY += (e.clientY - l.y) * LOOK_SPEED;
      input.lastOrbitAt = performance.now() / 1000;
      l.x = e.clientX;
      l.y = e.clientY;
    }
  };

  const onUp = (e: React.PointerEvent) => {
    if (stick.current?.id === e.pointerId) {
      stick.current = null;
      input.touch.x = 0;
      input.touch.y = 0;
      placeStick(false);
    }
    if (look.current?.id === e.pointerId) look.current = null;
  };

  /** Hold-style button: press sets the "pressed at" time (for buffering), hold = held. */
  const button = (which: "jump" | "crouch") => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.dataset["pressed"] = "true";
      const now = performance.now() / 1000;
      if (which === "jump") { input.jumpPressedAt = now; input.touch.jumpHeld = true; }
      else { input.crouchPressedAt = now; input.touch.crouchHeld = true; }
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => release(e.currentTarget, which),
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => release(e.currentTarget, which),
    onLostPointerCapture: (e: React.PointerEvent<HTMLButtonElement>) => release(e.currentTarget, which),
  });
  const release = (el: HTMLElement, which: "jump" | "crouch") => {
    el.dataset["pressed"] = "false";
    if (which === "jump") input.touch.jumpHeld = false;
    else input.touch.crouchHeld = false;
  };

  return (
    <div
      ref={layer}
      className="touch-layer"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div ref={base} className="touch-stick" data-active="false" aria-hidden>
        <div ref={knob} className="touch-knob" />
      </div>
      <div className="touch-buttons" data-panel-open={panelOpen}>
        {climbing && canGrab && (
          <button
            className="touch-btn touch-grab"
            aria-label="Grab"
            onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); input.grabPressedAt = performance.now() / 1000; e.currentTarget.dataset["pressed"] = "true"; }}
            onPointerUp={(e) => { e.currentTarget.dataset["pressed"] = "false"; }}
            onPointerCancel={(e) => { e.currentTarget.dataset["pressed"] = "false"; }}
          >
            <Hand size={20} aria-hidden />
            <span>Grab</span>
          </button>
        )}
        <button className="touch-btn touch-crouch" aria-label="Crouch" {...button("crouch")}>
          <ChevronsDown size={22} aria-hidden />
          <span>Crouch</span>
        </button>
        <button className="touch-btn touch-jump" aria-label="Jump" {...button("jump")}>
          <ArrowUp size={30} aria-hidden />
          <span>Jump</span>
        </button>
      </div>
    </div>
  );
}
