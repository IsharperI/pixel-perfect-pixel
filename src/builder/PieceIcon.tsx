import { BEHAVIOUR_COLOURS, PIECES, type PieceId } from "./pieces";

/** Little isometric pictures of each piece, in its behaviour colour. */
export function PieceIcon({ piece, size = 34 }: { piece: PieceId; size?: number }) {
  const c = BEHAVIOUR_COLOURS[PIECES[piece].behaviour];
  const top = c.colour, side = shade(c.colour, -0.12), front = shade(c.colour, -0.24), line = c.edge;
  const common = { stroke: line, strokeWidth: 1.2, strokeLinejoin: "round" as const };
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      {piece === "cube" && box(20, 9, 10, 10, 12)}
      {piece === "wide" && box(20, 11, 16, 16, 8)}
      {piece === "plank" && box(20, 13, 22, 6, 8)}
      {piece === "ramp" && (
        <>
          <path d="M6 30 L22 22 L34 28 L18 36 Z" fill={front} {...common} />
          <path d="M22 22 L34 28 L34 14 Z" fill={side} {...common} />
          <path d="M6 30 L22 22 L34 14 L18 22 Z" fill={top} {...common} />
        </>
      )}
      {piece === "steep" && (
        <>
          <path d="M10 30 L22 24 L30 28 L18 34 Z" fill={front} {...common} />
          <path d="M22 24 L30 28 L30 10 Z" fill={side} {...common} />
          <path d="M10 30 L22 24 L30 10 L18 16 Z" fill={top} {...common} />
        </>
      )}
      {piece === "start" && (
        <>
          <path d="M6 26 L20 19 L34 26 L20 33 Z" fill="#ffffff" {...common} />
          <ellipse cx="20" cy="26" rx="6" ry="3" fill="none" stroke="#22c55e" strokeWidth="2" />
          <path d="M20 24 L20 6" stroke="#475569" strokeWidth="1.6" />
          <path d="M20 6 L30 9.5 L20 13 Z" fill="#22c55e" stroke="#15803d" strokeWidth="1" />
        </>
      )}
      {piece === "goal" && (
        <>
          <defs>
            <pattern id="pi-check" width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="#fff" /><rect width="3" height="3" fill="#1f2937" /><rect x="3" y="3" width="3" height="3" fill="#1f2937" />
            </pattern>
          </defs>
          <path d="M6 30 L20 23 L34 30 L20 37 Z" fill="url(#pi-check)" stroke="#1f2937" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M14 30 L14 4" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="14" cy="4" r="1.8" fill="#fbbf24" />
          <path d="M14 5 L32 7 L32 18 L14 16 Z" fill="url(#pi-check)" stroke="#1f2937" strokeWidth="1" strokeLinejoin="round" />
        </>
      )}
      {piece === "bounce" && (
        <>
          <path d="M6 30 L20 23 L34 30 L20 37 Z" fill="#64748b" stroke="#334155" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M14 28 q6 -3 12 0 M14 24 q6 -3 12 0 M14 20 q6 -3 12 0" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
          <path d="M6 16 L20 9 L34 16 L20 23 Z" fill={top} stroke={line} strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M6 16 L6 19 L20 26 L34 19 L34 16" fill={front} stroke={line} strokeWidth="1.2" strokeLinejoin="round" />
        </>
      )}
      {piece === "checkpoint" && (
        <>
          <path d="M6 28 L20 21 L34 28 L20 35 Z" fill="#dbeafe" stroke="#1d4ed8" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M20 28 L20 6" stroke="#64748b" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M20 6 L32 10 L20 14 Z" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1" strokeLinejoin="round" />
        </>
      )}
      {piece === "lava" && (
        <>
          {box(20, 9, 10, 10, 12)}
          <path d="M14 14 q3 -3 6 0 t6 0" fill="none" stroke="#fecaca" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M17 7 q-1.5 -2 0 -4 M23 7 q1.5 -2 0 -4" fill="none" stroke="#cbd5e1" strokeWidth="1.3" strokeLinecap="round" />
        </>
      )}
      {piece === "star" && (
        <path
          d="M20 5 L24.1 14.4 L34.3 15.4 L26.6 22.2 L28.8 32.2 L20 27 L11.2 32.2 L13.4 22.2 L5.7 15.4 L15.9 14.4 Z"
          fill={top}
          stroke={line}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );

  /** An isometric box: (cx, ty) top corner, w/d along the two ground axes, h tall. */
  function box(cx: number, ty: number, w: number, d: number, h: number) {
    const k = 0.5;
    const L = [cx - w, ty + w * k], R = [cx + d, ty + d * k], B = [cx - w + d, ty + (w + d) * k];
    const T = [cx, ty];
    const p = (...pts: number[][]) => pts.map((q) => q.join(",")).join(" ");
    return (
      <>
        <polygon points={p(L, B, [B[0]!, B[1]! + h], [L[0]!, L[1]! + h])} fill={front} {...common} />
        <polygon points={p(B, R, [R[0]!, R[1]! + h], [B[0]!, B[1]! + h])} fill={side} {...common} />
        <polygon points={p(T, R, B, L)} fill={top} {...common} />
      </>
    );
  }
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + v * amt)));
  return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}
