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
