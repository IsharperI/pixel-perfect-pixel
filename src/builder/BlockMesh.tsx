import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import { BEHAVIOUR_COLOURS, PIECES, centre, type Block } from "./pieces";
import { checkerTexture, rampGeometry, starGeometry } from "./geometry";
import { registerFade } from "../game/fade";

const noRaycast = () => null;
const STENCIL_LEVEL = { stencilWrite: true, stencilRef: 0, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp };

type Look = "solid" | "ghost" | "invalid" | "erase";

/**
 * One building block, coloured by its behaviour. Used by the editor (with ghost,
 * invalid and "about to erase" looks) and in Play mode (where `fadeId` lets the
 * camera fade it when it blocks the view).
 */
export function BlockMesh({
  block, look = "solid", fadeId, editor = false, selected = false, local = false, locked = false,
}: {
  block: Omit<Block, "id"> & { id?: string };
  look?: Look;
  fadeId?: string;
  editor?: boolean;
  selected?: boolean;
  /** Draw at the parent's origin (inside a physics body that is already positioned and rotated) */
  local?: boolean;
  /** Goal flag only: grey with a padlock (it can't be reached yet) */
  locked?: boolean;
}) {
  const piece = PIECES[block.piece];
  const [w, h, l] = piece.size;
  const colours = BEHAVIOUR_COLOURS[piece.behaviour];
  const geometry = useMemo(() => (piece.ramp ? rampGeometry(w, h, l) : null), [piece.ramp, w, h, l]);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useEffect(() => (fadeId && mat.current ? registerFade(fadeId, mat.current) : undefined), [fadeId]);

  const colour = look === "invalid" ? "#ff5a5f" : look === "erase" ? "#ff8a8d" : colours.colour;
  const see = look === "ghost" || look === "invalid";
  const material = (
    <meshStandardMaterial
      ref={mat}
      color={colour}
      roughness={0.75}
      transparent={see}
      opacity={see ? 0.5 : 1}
      depthWrite={!see}
      emissive={selected ? "#3b82f6" : "#000000"}
      emissiveIntensity={selected ? 0.35 : 0}
      {...(see ? {} : STENCIL_LEVEL)}
    />
  );
  const edges = <Edges color={selected ? "#2563eb" : look === "invalid" ? "#c81e1e" : colours.edge} threshold={20} raycast={noRaycast} />;
  const [cx, cy, cz] = centre(block);

  return (
    <group position={local ? [0, 0, 0] : [cx, cy, cz]} rotation-y={local ? 0 : (block.rot * Math.PI) / 2} userData={{ blockId: block.id }}>
      {piece.behaviour === "start" ? (
        <>
          {/* The start pad: a thin white slab at the bottom of its cell */}
          <mesh position={[0, -h / 2 + 0.1, 0]} castShadow={!see} receiveShadow userData={{ blockId: block.id }}>
            <boxGeometry args={[0.92, 0.2, 0.92]} />
            {material}
            {edges}
          </mesh>
          {editor && !see && (
            <>
              <mesh position={[0, -h / 2 + 0.22, 0]} rotation-x={-Math.PI / 2} raycast={noRaycast}>
                <ringGeometry args={[0.22, 0.34, 32]} />
                <meshBasicMaterial color="#22c55e" />
              </mesh>
              {/* A little green flag on a pole */}
              <mesh position={[0.3, 0.05, -0.3]} raycast={noRaycast}>
                <cylinderGeometry args={[0.025, 0.025, 0.9, 8]} />
                <meshStandardMaterial color="#475569" />
              </mesh>
              <mesh position={[0.3, 0.38, -0.12]} rotation-y={-Math.PI / 2} raycast={noRaycast}>
                <coneGeometry args={[0.13, 0.36, 3]} />
                <meshStandardMaterial color="#22c55e" />
              </mesh>
            </>
          )}
        </>
      ) : piece.behaviour === "goal" ? (
        <GoalFlag id={block.id} h={h} see={see} locked={locked} tint={look === "solid" ? (locked ? "#b6bcc6" : null) : colour} edge={edges} selected={selected} fadeRef={mat} />
      ) : piece.behaviour === "star" ? (
        <Star id={block.id} see={see} colour={colour} selected={selected} edgeColour={selected ? "#2563eb" : look === "invalid" ? "#c81e1e" : colours.edge} />
      ) : (
        <mesh {...(geometry ? { geometry } : {})} castShadow={!see} receiveShadow userData={{ blockId: block.id }}>
          {!geometry && <boxGeometry args={[w, h, l]} />}
          {material}
          {edges}
        </mesh>
      )}
    </group>
  );
}

/** The goal: a checkered pad with a tall flag pole and a checkered flag. */
function GoalFlag({ id, h, see, locked, tint, edge, selected, fadeRef }: {
  id: string | undefined; h: number; see: boolean; locked: boolean; tint: string | null; edge: React.ReactNode; selected: boolean;
  fadeRef: React.RefObject<THREE.MeshStandardMaterial | null>;
}) {
  const map = useMemo(() => checkerTexture(), []);
  const flag = useRef<THREE.Mesh>(null);
  // A gentle flutter
  useFrame(({ clock }) => { if (flag.current) flag.current.rotation.y = Math.sin(clock.elapsedTime * 2.2) * 0.18; });
  const look = { transparent: see, opacity: see ? 0.5 : 1, depthWrite: !see };
  const glow = { emissive: selected ? "#3b82f6" : "#000000", emissiveIntensity: selected ? 0.35 : 0 };
  const bottom = -h / 2;
  return (
    <>
      <mesh position={[0, bottom + 0.1, 0]} castShadow={!see} receiveShadow userData={{ blockId: id }}>
        <boxGeometry args={[0.92, 0.2, 0.92]} />
        <meshStandardMaterial ref={fadeRef} {...(tint ? { color: tint } : { map })} roughness={0.7} {...look} {...glow} {...(see ? {} : STENCIL_LEVEL)} />
        {edge}
      </mesh>
      <mesh position={[0, bottom + 1.2, 0]} castShadow={!see} userData={{ blockId: id }}>
        <cylinderGeometry args={[0.04, 0.04, 2, 10]} />
        <meshStandardMaterial color={tint ?? "#64748b"} metalness={0.4} roughness={0.4} {...look} {...glow} />
      </mesh>
      <mesh position={[0, bottom + 2.24, 0]} raycast={noRaycast}>
        <sphereGeometry args={[0.08, 12, 8]} />
        <meshStandardMaterial color={tint ?? "#fbbf24"} {...look} />
      </mesh>
      {locked && <Padlock y={bottom + 1.05} />}
      <group position={[0, bottom + 1.9, 0]}>
        <mesh ref={flag} position={[0, 0, 0]} raycast={noRaycast}>
          <group position={[0.36, 0, 0]}>
            <mesh castShadow={!see} userData={{ blockId: id }}>
              <boxGeometry args={[0.7, 0.46, 0.03]} />
              <meshStandardMaterial {...(tint ? { color: tint } : { map })} side={THREE.DoubleSide} roughness={0.8} {...look} {...glow} />
            </mesh>
          </group>
        </mesh>
      </group>
    </>
  );
}

let starGeo: THREE.BufferGeometry | null = null;
const sharedStar = () => (starGeo ??= starGeometry()); // one shared shape for every star

/** A spinning, bobbing gold star. */
function Star({ id, see, colour, selected, edgeColour }: { id: string | undefined; see: boolean; colour: string; selected: boolean; edgeColour: string }) {
  const spin = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!spin.current) return;
    spin.current.rotation.y = clock.elapsedTime * 1.8;
    spin.current.position.y = Math.sin(clock.elapsedTime * 2.5) * 0.06;
  });
  return (
    <group ref={spin}>
      <mesh geometry={sharedStar()} castShadow={!see} userData={{ blockId: id }}>
        <meshStandardMaterial
          color={colour}
          metalness={0.35}
          roughness={0.3}
          emissive={selected ? "#3b82f6" : colour}
          emissiveIntensity={selected ? 0.45 : 0.25}
          transparent={see}
          opacity={see ? 0.5 : 1}
          depthWrite={!see}
        />
        <Edges color={edgeColour} threshold={25} raycast={noRaycast} />
      </mesh>
    </group>
  );
}

/** A chunky gold padlock hanging on the flag pole. */
function Padlock({ y }: { y: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (g.current) g.current.rotation.y = Math.sin(clock.elapsedTime * 1.5) * 0.5; });
  return (
    <group ref={g} position={[0, y, 0]}>
      <mesh position={[0, 0, 0.12]} raycast={noRaycast}>
        <boxGeometry args={[0.36, 0.3, 0.14]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.17, 0.12]} raycast={noRaycast}>
        <torusGeometry args={[0.11, 0.035, 8, 20, Math.PI]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, -0.02, 0.195]} raycast={noRaycast}>
        <circleGeometry args={[0.045, 12]} />
        <meshBasicMaterial color="#78350f" />
      </mesh>
    </group>
  );
}
