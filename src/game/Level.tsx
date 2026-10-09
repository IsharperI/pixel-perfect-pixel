import { useEffect, useId, useRef } from "react";
import * as THREE from "three";
import { RigidBody } from "@react-three/rapier";
import { registerFade } from "./fade";
import { Grid, Html } from "@react-three/drei";

type V3 = [number, number, number];

function Block({ pos, size, color, rot }: { pos: V3; size: V3; color: string; rot?: V3 }) {
  // Register so the camera can fade this block when it blocks the view.
  const fadeId = useId();
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useEffect(() => (mat.current ? registerFade(fadeId, mat.current) : undefined), [fadeId]);
  return (
    <RigidBody type="fixed" colliders="cuboid" position={pos} rotation={rot} userData={{ fadeId }}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial ref={mat} color={color} roughness={0.8} />
      </mesh>
    </RigidBody>
  );
}

function Label({ pos, text }: { pos: V3; text: string }) {
  return (
    <Html position={pos} center distanceFactor={14} zIndexRange={[5, 0]}>
      <div className="level-label">{text}</div>
    </Html>
  );
}

const COLORS = ["#7cc6fe", "#ffd166", "#06d6a0", "#ef8fb7", "#b8a1ff"];
const colorAt = (i: number): string => COLORS[i % COLORS.length]!;

export function Level() {
  // Jump gap ladder (x = -12), platforms top at y = 1
  const gaps = [2, 3, 4, 5, 6];
  const gapPlats: { z: number }[] = [{ z: -2 }];
  gaps.forEach((g, i) => gapPlats.push({ z: gapPlats[i]!.z - 3 - g }));

  // Height ladder (x = 12)
  const heights = [1, 2, 3, 4, 5];

  return (
    <group>
      {/* Ground */}
      <RigidBody type="fixed" colliders="cuboid" position={[0, -0.5, 0]}>
        <mesh receiveShadow>
          <boxGeometry args={[140, 1, 140]} />
          <meshStandardMaterial color="#cfe8c4" roughness={1} />
        </mesh>
      </RigidBody>
      <Grid
        position={[0, 0.01, 0]}
        args={[140, 140]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#9cc79a"
        sectionSize={5}
        sectionThickness={1.2}
        sectionColor="#6fa86e"
        fadeDistance={90}
        fadeStrength={1.5}
        infiniteGrid={false}
      />

      {/* Start pad */}
      <Block pos={[0, 0.1, 6]} size={[3, 0.2, 3]} color="#ffffff" />
      <Label pos={[0, 1.2, 8.2]} text="START" />

      {/* Gap ladder */}
      {gapPlats.map((p, i) => (
        <Block key={`g${i}`} pos={[-12, 0.5, p.z]} size={[3, 1, 3]} color={colorAt(i)} />
      ))}
      {gaps.map((g, i) => (
        <Label key={`gl${i}`} pos={[-12, 2, gapPlats[i]!.z - 1.5 - g / 2]} text={`${g}u gap`} />
      ))}
      <Label pos={[-12, 3, 1.2]} text="GAP LADDER" />

      {/* Height ladder */}
      {heights.map((h, i) => (
        <group key={`h${i}`}>
          <Block pos={[12, h / 2, -2 - i * 5]} size={[3, h, 3]} color={colorAt(i + 2)} />
          <Label pos={[12, h + 0.8, -2 - i * 5]} text={`${h}u`} />
        </group>
      ))}
      <Label pos={[12, 3, 1.2]} text="HEIGHT LADDER" />

      {/* Floating platforms */}
      {([
        [-5, 2, -10],
        [-1, 3.5, -14],
        [3, 5, -18],
        [-2, 6.5, -23],
        [4, 2.5, -26],
      ] as V3[]).map((p, i) => (
        <Block key={`f${i}`} pos={p} size={[2.5, 0.4, 2.5]} color={colorAt(i + 1)} />
      ))}

      {/* Tall wall */}
      <Block pos={[22, 5, -6]} size={[1, 10, 14]} color="#f4a582" />
      <Label pos={[20.8, 10.8, -6]} text="TALL WALL" />

      {/* Gentle slope rising to a narrow ledge (coyote time test) */}
      <Block pos={[-24, 1.75, -6]} size={[3, 0.5, Math.hypot(12, 4)]} rot={[Math.atan2(4, 12), 0, 0]} color="#ffd166" />
      <Label pos={[-24, 1.5, 1]} text="SLOPE" />
      <Block pos={[-24, 3.75, -18]} size={[1, 0.5, 12]} color="#ef8fb7" />
      <Label pos={[-24, 5.2, -23.5]} text="NARROW LEDGE — walk off" />
    </group>
  );
}
