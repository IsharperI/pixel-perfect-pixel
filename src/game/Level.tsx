import { useEffect, useId, useRef } from "react";
import * as THREE from "three";
import { RigidBody } from "@react-three/rapier";
import { registerFade } from "./fade";
import { Targets } from "./Targets";
import { CHAIN_X, TEST_LEVEL_TARGETS } from "./targets";
import { Grid, Html } from "@react-three/drei";
import { FACE, boxFaces, climbFaces } from "./climb";
import { vineTexture } from "../builder/geometry";

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
        {/* Tagged "level" (0) in the stencil buffer, so the player silhouette shows through it */}
        <meshStandardMaterial ref={mat} color={color} roughness={0.8} stencilWrite stencilRef={0} stencilFunc={THREE.AlwaysStencilFunc} stencilZPass={THREE.ReplaceStencilOp} />
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
          <meshStandardMaterial color="#cfe8c4" roughness={1} stencilWrite stencilRef={0} stencilFunc={THREE.AlwaysStencilFunc} stencilZPass={THREE.ReplaceStencilOp} />
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

      {/* Steepness test ramps: each rises 4 units toward -z, with a landing on top */}
      {([30, 45, 60] as const).map((deg, i) => {
        const h = 4, run = h / Math.tan((deg * Math.PI) / 180), x = -30 - i * 4.5;
        return (
          <group key={deg}>
            <Block pos={[x, h / 2 - 0.25, -run / 2]} size={[3, 0.5, Math.hypot(run, h) + 0.3]} rot={[Math.atan2(h, run), 0, 0]} color={colorAt(i + 3)} />
            <Block pos={[x, h - 0.25, -run - 1.5]} size={[3, 0.5, 3]} color={colorAt(i + 3)} />
            <Label pos={[x, 1.2, 1.6]} text={`${deg}°`} />
          </group>
        );
      })}
      <Label pos={[-34.5, 6, -4]} text="RAMPS" />

      {/* Vine wall: press E to grab on and climb (its front, facing the start, has vines) */}
      <VineWall />

      {/* Homing attack chain: floating targets rising to a high platform */}
      <Targets list={TEST_LEVEL_TARGETS} />
      {/* Landing just past the last target: the bounce carries you onto it */}
      <Block pos={[CHAIN_X, 10.5, -14]} size={[4, 0.5, 4]} color={colorAt(4)} />
      <Label pos={[CHAIN_X + 2.5, 5, 9]} text="HOMING CHAIN" />
    </group>
  );
}

/** A 3-wide, 5-tall wall right of the start, with climbable vines on its front. */
function VineWall() {
  const min = [5.5, 0, 0.5] as const, max = [8.5, 5, 1.5] as const;
  useEffect(() => {
    const faces = boxFaces(min, max, FACE.pz);
    climbFaces.push(...faces);
    return () => { for (const f of faces) { const i = climbFaces.indexOf(f); if (i >= 0) climbFaces.splice(i, 1); } };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- fixed wall
  return (
    <group>
      <Block pos={[7, 2.5, 1]} size={[3, 5, 1]} color="#e9cf9d" />
      <mesh position={[7, 2.5, 1.51]}>
        <planeGeometry args={[3, 5]} />
        <meshStandardMaterial map={vineTexture(3, 5)} transparent alphaTest={0.05} roughness={0.85} />
      </mesh>
      <Label pos={[7, 5.8, 1]} text="VINES — press E" />
    </group>
  );
}
