import * as THREE from "three";

/**
 * A wedge (ramp) centred on the origin: `w` wide (x), `h` tall (y), `l` long (z),
 * low at -z and rising to full height at +z. Flat-shaded, faces pointing outward.
 */
export function rampGeometry(w: number, h: number, l: number) {
  const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2, z0 = -l / 2, z1 = l / 2;
  const A = [x0, y0, z0], B = [x1, y0, z0], C = [x1, y0, z1], D = [x0, y0, z1]; // bottom
  const E = [x0, y1, z1], F = [x1, y1, z1]; // top back edge
  // Each face listed counter-clockwise as seen from outside
  const faces = [
    [A, B, C, D], // bottom (facing down)
    [D, C, F, E], // back wall (facing +z)
    [A, E, F, B], // slope (facing up and toward -z)
    [A, D, E], // left side (facing -x)
    [B, F, C], // right side (facing +x)
  ];
  const pos: number[] = [];
  for (const f of faces) for (let i = 1; i < f.length - 1; i++) pos.push(...f[0]!, ...f[i]!, ...f[i + 1]!);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** A chunky five-pointed star, standing upright and facing +z, about `size` across. */
export function starGeometry(size = 0.8, depth = 0.22): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const outer = size / 2, inner = outer * 0.48;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 1 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

let checker: THREE.CanvasTexture | null = null;
/** A black-and-white checkerboard texture (shared), `cells` squares across. */
export function checkerTexture(cells = 4): THREE.Texture {
  if (checker) return checker;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const s = 64 / cells;
  for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) {
    ctx.fillStyle = (i + j) % 2 ? "#1f2937" : "#ffffff";
    ctx.fillRect(i * s, j * s, s, s);
  }
  checker = new THREE.CanvasTexture(c);
  checker.magFilter = THREE.NearestFilter;
  checker.colorSpace = THREE.SRGBColorSpace;
  return checker;
}

let vineCanvas: HTMLCanvasElement | null = null;
const vineTextures = new Map<string, THREE.Texture>();
/** A leafy vine texture (one tile per block), repeated `w` × `h` times. Shared per size. */
export function vineTexture(w: number, h: number): THREE.Texture {
  const key = `${w}x${h}`;
  const hit = vineTextures.get(key);
  if (hit) return hit;
  if (!vineCanvas) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const ctx = c.getContext("2d")!;
    // A green wash, so the whole face reads as "vine green"
    ctx.fillStyle = "rgba(74, 222, 128, 0.55)";
    ctx.fillRect(0, 0, 128, 128);
    // Wavy stems running up, with leaves on alternating sides (wrapping top to bottom)
    const stem = (x0: number, phase: number) => {
      ctx.strokeStyle = "#166534";
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let y = -8; y <= 136; y += 4) {
        const x = x0 + Math.sin((y / 128) * Math.PI * 2 + phase) * 9;
        if (y === -8) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const y = i * 21 + 6;
        const x = x0 + Math.sin((y / 128) * Math.PI * 2 + phase) * 9;
        const side = i % 2 ? 1 : -1;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(side * 0.9);
        ctx.fillStyle = i % 3 === 0 ? "#22c55e" : "#16a34a";
        ctx.beginPath();
        ctx.ellipse(side * 9, 0, 10, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#14532d";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.restore();
      }
    };
    stem(32, 0);
    stem(96, Math.PI);
    vineCanvas = c;
  }
  const tex = new THREE.CanvasTexture(vineCanvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(w, h);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  vineTextures.set(key, tex);
  return tex;
}
