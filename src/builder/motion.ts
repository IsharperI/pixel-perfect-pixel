/**
 * Where a moving platform is at any moment. A pure function of time, so the
 * platform, the editor preview and the character riding it always agree.
 */
import type { Block, Motion } from "./pieces";
import { centre } from "./pieces";

export type V3 = [number, number, number];

export const SPEEDS = { slow: 1.5, medium: 3, fast: 5 } as const;
export const WAITS = { none: 0, short: 0.5, long: 1.5 } as const;

export const defaultMotion = (): Motion => ({ stops: [[3, 0, 0]], speed: SPEEDS.medium, wait: WAITS.short, trigger: "always", loop: false });

/** The centre of the platform at each stop (stop 0 is where it was built). */
export function stopCentres(b: Pick<Block, "piece" | "x" | "y" | "z" | "rot" | "move">): V3[] {
  const c = centre(b);
  return [c, ...(b.move?.stops ?? []).map(([dx, dy, dz]) => [c[0] + dx, c[1] + dy, c[2] + dz] as V3)];
}

type Leg = { from: V3; to: V3; wait: number; travel: number };

/** The legs of one full trip: back and forth (1→2→3→2→1) or a loop (1→2→3→1). */
function legs(points: V3[], m: Pick<Motion, "speed" | "wait" | "loop">): Leg[] {
  const order: number[] = points.map((_, i) => i);
  if (m.loop) order.push(0);
  else for (let i = points.length - 2; i >= 0; i--) order.push(i);
  const out: Leg[] = [];
  for (let i = 0; i < order.length - 1; i++) {
    const from = points[order[i]!]!, to = points[order[i + 1]!]!;
    const d = Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    out.push({ from, to, wait: m.wait, travel: d / Math.max(0.1, m.speed) });
  }
  return out;
}

/** How long one full trip takes, in seconds (0 if it doesn't really move). */
export function tripLength(points: V3[], m: Pick<Motion, "speed" | "wait" | "loop">) {
  if (points.length < 2) return 0;
  return legs(points, m).reduce((t, l) => t + l.wait + l.travel, 0);
}

/** Position of the platform's centre `t` seconds after it starts moving. */
export function positionAt(points: V3[], m: Pick<Motion, "speed" | "wait" | "loop">, t: number): V3 {
  if (points.length < 2) return points[0] ?? [0, 0, 0];
  const L = legs(points, m);
  const total = L.reduce((s, l) => s + l.wait + l.travel, 0);
  if (total <= 0) return points[0]!;
  let r = ((t % total) + total) % total;
  for (const l of L) {
    if (r < l.wait) return l.from;
    r -= l.wait;
    if (r < l.travel) {
      // Ease in and out, so it starts and stops gently
      const u = l.travel > 0 ? r / l.travel : 1;
      const k = 0.5 - 0.5 * Math.cos(Math.PI * u);
      return [l.from[0] + (l.to[0] - l.from[0]) * k, l.from[1] + (l.to[1] - l.from[1]) * k, l.from[2] + (l.to[2] - l.from[2]) * k];
    }
    r -= l.travel;
  }
  return points[0]!;
}

/** Where a new stop goes: carry on in the direction of the last leg (or 3 blocks along x for the first). */
export function nextStopOffset(m: Motion): V3 {
  const pts: V3[] = [[0, 0, 0], ...m.stops];
  const last = pts[pts.length - 1]!, prev = pts[pts.length - 2];
  if (!prev) return [3, 0, 0];
  const d: V3 = [last[0] - prev[0], last[1] - prev[1], last[2] - prev[2]];
  if (d[0] === 0 && d[1] === 0 && d[2] === 0) return [last[0] + 3, last[1], last[2]];
  return [last[0] + d[0], last[1] + d[1], last[2] + d[2]];
}

/** Clean up motion read from a file. Returns undefined if it's unusable. */
export function readMotion(raw: unknown): Motion | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const stops = Array.isArray(o["stops"])
    ? (o["stops"] as unknown[])
        .filter((s): s is V3 => Array.isArray(s) && s.length === 3 && s.every((v) => typeof v === "number" && Number.isInteger(v) && Math.abs(v) <= 60))
        .slice(0, 12)
    : [];
  if (!stops.length) return undefined;
  const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  return {
    stops,
    speed: num(o["speed"], 0.5, 10, SPEEDS.medium),
    wait: num(o["wait"], 0, 5, WAITS.short),
    trigger: o["trigger"] === "step" ? "step" : "always",
    loop: o["loop"] === true,
  };
}
