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
