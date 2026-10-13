import { useEffect, useMemo, useRef } from "react";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import { BEHAVIOUR_COLOURS, PIECES, centre, type Block } from "./pieces";
import { rampGeometry } from "./geometry";
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
  block, look = "solid", fadeId, editor = false, selected = false, local = false,
}: {
  block: Omit<Block, "id"> & { id?: string };
  look?: Look;
  fadeId?: string;
  editor?: boolean;
  selected?: boolean;
  /** Draw at the parent's origin (inside a physics body that is already positioned and rotated) */
  local?: boolean;
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
