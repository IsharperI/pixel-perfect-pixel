import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { rampGeometry } from "./geometry";

describe("ramp geometry", () => {
  it("has every face pointing outward", () => {
    const g = rampGeometry(1, 1, 2);
    const p = g.getAttribute("position");
    const centroid = new THREE.Vector3(0, -1 / 6, 1 / 6); // roughly the wedge's middle
    for (let i = 0; i < p.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, i);
      const b = new THREE.Vector3().fromBufferAttribute(p, i + 1);
      const c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
      const normal = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
      const mid = a.clone().add(b).add(c).divideScalar(3);
      expect(normal.dot(mid.sub(centroid)), `triangle ${i / 3}`).toBeGreaterThan(0);
    }
  });
  it("slopes up toward +z", () => {
    const g = rampGeometry(1, 1, 2);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.y).toBeCloseTo(0.5);
    // the slope triangle's normal points up and toward -z
    const p = g.getAttribute("position");
    const n = g.getAttribute("normal");
    let found = false;
    for (let i = 0; i < n.count; i++) if (n.getY(i) > 0.5 && n.getZ(i) < -0.2) found = true;
    expect(found).toBe(true);
    expect(p.count).toBe(24); // 3 quads (6 tris) + 2 triangles = 8 tris
  });
});
