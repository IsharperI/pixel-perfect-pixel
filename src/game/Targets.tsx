import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TARGETS, homingState, isActive, type Target } from "./targets";

/** Floating homing-attack targets plus the lock-on reticle. Visual only (no collision). */
export function Targets({ list, orbs = true }: { list: Target[]; orbs?: boolean }) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  // Make these the live targets while this scene is showing
  useEffect(() => {
    TARGETS.splice(0, TARGETS.length, ...list);
    return () => { TARGETS.splice(0, TARGETS.length); homingState.lockedId = -1; };
  }, [list]);
  const reticle = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    const now = performance.now() / 1000;
    list.forEach((t, i) => {
      const g = groups.current[i];
      if (!g) return;
      // Popped targets shrink away and grow back when they return
      const want = isActive(t, now) ? 1 : 0;
      const k = g.scale.x + (want - g.scale.x) * (want ? 0.12 : 0.35);
      g.scale.setScalar(k < 0.01 ? 0.0001 : k);
      g.position.set(t.pos.x, t.pos.y + Math.sin(now * 2 + i) * 0.12, t.pos.z);
      g.rotation.y = now * 1.6 + i;
    });
    const r = reticle.current;
    if (r) {
      const t = list[homingState.lockedId];
      r.visible = !!t;
      if (t) {
        r.position.set(t.pos.x, t.pos.y + Math.sin(now * 2 + t.id) * 0.12, t.pos.z);
        r.quaternion.copy(camera.quaternion); // always face the camera
        r.rotateZ(now * 3);
        r.scale.setScalar(1 + Math.sin(now * 10) * 0.08);
      }
    }
  });

  return (
    <group>
      {orbs && list.map((t, i) => (
        <group key={t.id} ref={(el) => { groups.current[i] = el; }} position={t.pos.toArray()}>
          <mesh castShadow>
            <torusGeometry args={[0.55, 0.11, 12, 32]} />
            <meshStandardMaterial color="#ffc93c" emissive="#ff9f1c" emissiveIntensity={0.5} metalness={0.4} roughness={0.3} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.28, 16, 12]} />
            <meshStandardMaterial color="#ffffff" emissive="#7cc6fe" emissiveIntensity={0.9} />
          </mesh>
        </group>
      ))}
      {/* Lock-on reticle: four corner brackets around the locked target */}
      <group ref={reticle} visible={false} renderOrder={20}>
        {[0, 1, 2, 3].map((q) => (
          <mesh key={q} rotation-z={(q * Math.PI) / 2} position={[Math.cos((q * Math.PI) / 2 + Math.PI / 4) * 1.05, Math.sin((q * Math.PI) / 2 + Math.PI / 4) * 1.05, 0]}>
            <ringGeometry args={[0.2, 0.38, 3, 1, 0, Math.PI / 2]} />
            <meshBasicMaterial color="#ff4d6d" depthTest={false} transparent opacity={0.95} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
