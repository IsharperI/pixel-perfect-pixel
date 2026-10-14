import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import { BEHAVIOUR_COLOURS, PIECES, behaviourOf, centre, type Block } from "./pieces";
import { checkerTexture, rampGeometry, starGeometry, vineTexture } from "./geometry";
import { FACE } from "../game/climb";
import { bouncePads, squish } from "../game/bounce";
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
  block, look = "solid", fadeId, editor = false, selected = false, local = false, locked = false, vinePreview, lit,
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
  /** Checkpoints in Play: lit up once you've reached them (grey until then) */
  lit?: boolean;
  /** Painting: a side (local face bit) to highlight, and whether painting adds or removes vines there */
  vinePreview?: { face: number; add: boolean } | undefined;
}) {
  const piece = PIECES[block.piece];
  const [w, h, l] = piece.size;
  const colours = BEHAVIOUR_COLOURS[behaviourOf(block)];
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
      // (gentler on orange, which a strong blue glow would turn slope-pink)
      emissiveIntensity={selected ? (block.move ? 0.1 : 0.35) : 0}
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
      ) : piece.behaviour === "checkpoint" ? (
        <Checkpoint id={block.id} h={h} see={see} tint={look === "solid" ? null : colour} edge={edges} selected={selected} fadeRef={mat} lit={lit ?? true} />
      ) : piece.behaviour === "danger" ? (
        <Lava id={block.id} w={w} h={h} l={l} see={see} colour={colour} edge={edges} fadeRef={mat} />
      ) : piece.behaviour === "bounce" ? (
        <BouncePad id={block.id} h={h} see={see} colour={colour} edge={edges} selected={selected} fadeRef={mat} />
      ) : piece.behaviour === "goal" ? (
        <GoalFlag id={block.id} h={h} see={see} locked={locked} tint={look === "solid" ? (locked ? "#b6bcc6" : null) : colour} edge={edges} selected={selected} fadeRef={mat} />
      ) : piece.behaviour === "star" ? (
        <Star id={block.id} see={see} colour={colour} selected={selected} edgeColour={selected ? "#2563eb" : look === "invalid" ? "#c81e1e" : colours.edge} />
      ) : (
        <>
          <mesh {...(geometry ? { geometry } : {})} castShadow={!see} receiveShadow userData={{ blockId: block.id }}>
            {!geometry && <boxGeometry args={[w, h, l]} />}
            {material}
            {edges}
          </mesh>
          {/* Climbable vines on painted sides */}
          {!see && (!!block.vines || !!vinePreview) && <Vines mask={block.vines ?? 0} w={w} h={h} l={l} preview={vinePreview} />}
          {/* Tilting platforms: a pivot marker in the middle of the top */}
          {block.tilt && !see && (
            <mesh position={[0, h / 2 + 0.005, 0]} rotation-x={-Math.PI / 2} raycast={noRaycast}>
              <ringGeometry args={[0.1, 0.2, 24]} />
              <meshBasicMaterial color="#5b21b6" />
            </mesh>
          )}
        </>
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

/** Leafy vine panels on a block's painted sides (in its own frame), plus the paint tool's hover highlight. */
function Vines({ mask, w, h, l, preview }: { mask: number; w: number; h: number; l: number; preview?: { face: number; add: boolean } | undefined }) {
  const sides: { bit: number; pos: [number, number, number]; ry: number; width: number }[] = [
    { bit: FACE.px, pos: [w / 2 + 0.012, 0, 0], ry: Math.PI / 2, width: l },
    { bit: FACE.nx, pos: [-w / 2 - 0.012, 0, 0], ry: -Math.PI / 2, width: l },
    { bit: FACE.pz, pos: [0, 0, l / 2 + 0.012], ry: 0, width: w },
    { bit: FACE.nz, pos: [0, 0, -l / 2 - 0.012], ry: Math.PI, width: w },
  ];
  return (
    <>
      {sides.filter((sd) => mask & sd.bit).map((sd) => (
        <mesh key={sd.bit} position={sd.pos} rotation-y={sd.ry} raycast={noRaycast}>
          <planeGeometry args={[sd.width, h]} />
          <meshStandardMaterial map={vineTexture(sd.width, h)} transparent alphaTest={0.05} roughness={0.85} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      ))}
      {preview && sides.filter((sd) => sd.bit === preview.face).map((sd) => (
        <mesh key={`p${sd.bit}`} position={[sd.pos[0] * 1.01, sd.pos[1], sd.pos[2] * 1.01]} rotation-y={sd.ry} raycast={noRaycast}>
          <planeGeometry args={[sd.width, h]} />
          <meshBasicMaterial color={preview.add ? "#22c55e" : "#ef4444"} transparent opacity={0.35} depthWrite={false} polygonOffset polygonOffsetFactor={-4} />
        </mesh>
      ))}
    </>
  );
}

/** A bounce pad: a base, a coiled spring, and a top plate that squishes when it fires. Low enough (0.28) to walk onto. */
function BouncePad({ id, h, see, colour, edge, selected, fadeRef }: {
  id: string | undefined; h: number; see: boolean; colour: string; edge: React.ReactNode; selected: boolean;
  fadeRef: React.RefObject<THREE.MeshStandardMaterial | null>;
}) {
  const plate = useRef<THREE.Group>(null);
  const coil = useRef<THREE.Group>(null);
  const bottom = -h / 2;
  useFrame(() => {
    const pad = id ? bouncePads.find((p) => p.id === id) : undefined;
    const k = pad ? squish(performance.now() / 1000 - pad.boingAt) : 0;
    if (plate.current) plate.current.position.y = bottom + 0.24 - k * 0.12;
    if (coil.current) coil.current.scale.y = 1 - k * 0.8;
  });
  const look = { transparent: see, opacity: see ? 0.5 : 1, depthWrite: !see };
  const glow = { emissive: selected ? "#3b82f6" : "#000000", emissiveIntensity: selected ? 0.35 : 0 };
  return (
    <>
      <mesh position={[0, bottom + 0.04, 0]} castShadow={!see} receiveShadow userData={{ blockId: id }}>
        <boxGeometry args={[0.92, 0.08, 0.92]} />
        <meshStandardMaterial ref={fadeRef} color="#475569" roughness={0.6} {...look} {...glow} {...(see ? {} : STENCIL_LEVEL)} />
      </mesh>
      <group ref={coil} position={[0, bottom + 0.08, 0]}>
        {[0.03, 0.08, 0.13].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation-x={Math.PI / 2} raycast={noRaycast}>
            <torusGeometry args={[0.26, 0.028, 8, 20]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.3} {...look} />
          </mesh>
        ))}
      </group>
      <group ref={plate} position={[0, bottom + 0.24, 0]}>
        <mesh castShadow={!see} receiveShadow userData={{ blockId: id }}>
          <boxGeometry args={[0.92, 0.08, 0.92]} />
          <meshStandardMaterial color={colour} roughness={0.5} {...look} {...glow} {...(see ? {} : STENCIL_LEVEL)} />
          {edge}
        </mesh>
      </group>
    </>
  );
}

/** A checkpoint: a pad with a short pole and a pennant, blue when lit (grey until you reach it in Play). */
function Checkpoint({ id, h, see, tint, edge, selected, fadeRef, lit }: {
  id: string | undefined; h: number; see: boolean; tint: string | null; edge: React.ReactNode; selected: boolean;
  fadeRef: React.RefObject<THREE.MeshStandardMaterial | null>; lit: boolean;
}) {
  const flag = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (flag.current) flag.current.rotation.y = Math.sin(clock.elapsedTime * 2.6) * (lit ? 0.25 : 0.08); });
  const look = { transparent: see, opacity: see ? 0.5 : 1, depthWrite: !see };
  const glow = { emissive: selected ? "#3b82f6" : "#000000", emissiveIntensity: selected ? 0.35 : 0 };
  const bottom = -h / 2;
  const flagColour = tint ?? (lit ? "#3b82f6" : "#9ca3af");
  return (
    <>
      <mesh position={[0, bottom + 0.08, 0]} castShadow={!see} receiveShadow userData={{ blockId: id }}>
        <boxGeometry args={[0.92, 0.16, 0.92]} />
        <meshStandardMaterial ref={fadeRef} color={tint ?? "#dbeafe"} roughness={0.7} {...look} {...glow} {...(see ? {} : STENCIL_LEVEL)} />
        {edge}
      </mesh>
      <mesh position={[0, bottom + 0.85, 0]} castShadow={!see} userData={{ blockId: id }}>
        <cylinderGeometry args={[0.035, 0.035, 1.4, 8]} />
        <meshStandardMaterial color={tint ?? "#64748b"} metalness={0.4} roughness={0.4} {...look} />
      </mesh>
      <group ref={flag} position={[0, bottom + 1.35, 0]}>
        <mesh position={[0.24, 0, 0]} rotation-z={-Math.PI / 2} castShadow={!see} userData={{ blockId: id }}>
          <coneGeometry args={[0.17, 0.48, 3]} />
          <meshStandardMaterial color={flagColour} emissive={lit && !tint ? "#3b82f6" : "#000000"} emissiveIntensity={lit && !tint ? 0.35 : 0} {...look} />
        </mesh>
      </group>
    </>
  );
}

/** Lava: a glowing red-orange block that gently pulses. */
function Lava({ id, w, h, l, see, colour, edge, fadeRef }: {
  id: string | undefined; w: number; h: number; l: number; see: boolean; colour: string; edge: React.ReactNode;
  fadeRef: React.RefObject<THREE.MeshStandardMaterial | null>;
}) {
  const glowMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => { if (glowMat.current) glowMat.current.emissiveIntensity = 0.55 + Math.sin(clock.elapsedTime * 3) * 0.2; });
  const look = { transparent: see, opacity: see ? 0.5 : 1, depthWrite: !see };
  return (
    <>
      <mesh castShadow={!see} receiveShadow userData={{ blockId: id }}>
        <boxGeometry args={[w, h, l]} />
        <meshStandardMaterial ref={fadeRef} color={colour} roughness={0.6} emissive="#f97316" emissiveIntensity={see ? 0 : 0.35} {...look} {...(see ? {} : STENCIL_LEVEL)} />
        {edge}
      </mesh>
      {!see && (
        <mesh position={[0, h / 2 + 0.006, 0]} rotation-x={-Math.PI / 2} raycast={noRaycast}>
          <planeGeometry args={[w * 0.96, l * 0.96]} />
          <meshStandardMaterial ref={glowMat} color="#fb923c" emissive="#fbbf24" emissiveIntensity={0.55} roughness={0.4} />
        </mesh>
      )}
    </>
  );
}
