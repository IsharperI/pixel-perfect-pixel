import { useEffect, useMemo, useRef, useState } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Grid, OrbitControls, TransformControls } from "@react-three/drei";
import * as THREE from "three";
import { BlockMesh } from "./BlockMesh";
import { Water } from "./Water";
import { useLevel } from "./levelStore";
import { placementFor } from "./placement";
import { BUILD_LIMIT, canPlace, centre, footprint, type Block } from "./pieces";

// The editor camera is remembered across Play sessions, so stopping play returns you to the same view
const savedView = { pos: new THREE.Vector3(9, 11, 14), target: new THREE.Vector3(0, 1, -2) };
// Set while the move gizmo is being used, so that click doesn't also select/deselect blocks
let gizmoBusyUntil = 0;

type Ghost = { x: number; y: number; z: number; ok: boolean };

/** Find which block (if any) a pointer event hit. */
function blockFromEvent(e: ThreeEvent<PointerEvent | MouseEvent>, blocks: Block[]): Block | null {
  let o: THREE.Object3D | null = e.object;
  while (o) {
    const id = o.userData?.["blockId"] as string | undefined;
    if (id) return blocks.find((b) => b.id === id) ?? null;
    o = o.parent;
  }
  return null;
}

export function EditorScene() {
  const blocks = useLevel((s) => s.blocks);
  const tool = useLevel((s) => s.tool);
  const piece = useLevel((s) => s.piece);
  const rot = useLevel((s) => s.rot);
  const selectedId = useLevel((s) => s.selectedId);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [eraseId, setEraseId] = useState<string | null>(null);
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const { camera } = useThree();

  // Restore the editor view (and normal field of view) when coming back from Play
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.copy(savedView.pos);
    cam.fov = 50;
    cam.updateProjectionMatrix();
    controls.current?.target.copy(savedView.target);
    controls.current?.update();
    return () => {
      savedView.pos.copy(cam.position);
      if (controls.current) savedView.target.copy(controls.current.target);
    };
  }, [camera]);

  // Clear hover previews when switching tools or pieces
  useEffect(() => { setGhost(null); setEraseId(null); }, [tool, piece, rot]);

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation(); // only the nearest surface counts
    const hit = blockFromEvent(e, blocks);
    if (tool === "erase") { setEraseId(hit?.id ?? null); return; }
    if (tool !== "build" || !e.face) { setGhost(null); return; }
    const n = e.face.normal.clone().transformDirection(e.object.matrixWorld);
    const at = placementFor(hit, e.point, n, piece, rot);
    setGhost({ ...at, ok: canPlace({ piece, rot, ...at }, blocks) });
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 5 || performance.now() < gizmoBusyUntil) return; // it was a camera drag, or a gizmo click
    const hit = blockFromEvent(e, blocks);
    const S = useLevel.getState();
    if (tool === "build" && ghost?.ok) S.place({ piece, rot, x: ghost.x, y: ghost.y, z: ghost.z });
    else if (tool === "erase" && hit) { S.remove(hit.id); setEraseId(null); }
    else if (tool === "select") S.select(hit?.id ?? null);
  };

  const selected = blocks.find((b) => b.id === selectedId) ?? null;

  return (
    <>
      <OrbitControls
        ref={controls}
        makeDefault
        enableDamping
        dampingFactor={0.12}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minDistance={4}
        maxDistance={70}
        mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
      />
      <Grid
        position={[0, 0.002, 0]}
        args={[BUILD_LIMIT * 2, BUILD_LIMIT * 2]}
        cellSize={1}
        cellThickness={0.9}
        cellColor="#d6f0ff"
        sectionSize={5}
        sectionThickness={1.5}
        sectionColor="#ffffff"
        fadeDistance={90}
        fadeStrength={1.2}
      />

      <group onPointerMove={onMove} onPointerOut={() => { setGhost(null); setEraseId(null); }} onClick={onClick}>
        {/* The water you build on (height 0): click it to place blocks */}
        <Water />
        {blocks.map((b) => (
          <BlockMesh key={b.id} block={b} editor look={b.id === eraseId ? "erase" : "solid"} selected={b.id === selectedId && tool === "select"} />
        ))}
      </group>

      {tool === "build" && ghost && <BlockMesh block={{ piece, rot, x: ghost.x, y: ghost.y, z: ghost.z }} look={ghost.ok ? "ghost" : "invalid"} />}
      {tool === "build" && ghost && ghost.y > 0 && <HeightGuide block={{ piece, rot, x: ghost.x, y: ghost.y, z: ghost.z }} />}
      {tool === "select" && selected && <MoveGizmo block={selected} blocks={blocks} />}
    </>
  );
}

/** Drag the selected block along x/y/z with arrows; it snaps to the grid and won't overlap others. */
function MoveGizmo({ block, blocks }: { block: Block; blocks: Block[] }) {
  const proxy = useRef<THREE.Group>(null);
  const [preview, setPreview] = useState<Ghost | null>(null);
  const [cx, cy, cz] = centre(block);

  // Put the gizmo at the block's centre (again) whenever the block moves or rotates
  useEffect(() => { proxy.current?.position.set(cx, cy, cz); }, [cx, cy, cz]);

  const snapped = () => {
    const p = proxy.current!.position;
    const [fx, h, fz] = footprint(block.piece, block.rot);
    const at = { x: Math.round(p.x - fx / 2), y: Math.max(0, Math.round(p.y - h / 2)), z: Math.round(p.z - fz / 2) };
    return { ...at, ok: canPlace({ ...block, ...at }, blocks, block.id) };
  };

  return (
    <>
      <group ref={proxy} position={[cx, cy, cz]} />
      <TransformControls
        object={proxy as React.RefObject<THREE.Object3D>}
        mode="translate"
        size={0.85}
        onMouseDown={() => { gizmoBusyUntil = Infinity; }}
        onObjectChange={() => setPreview(snapped())}
        onMouseUp={() => {
          const at = snapped();
          if (at.ok) useLevel.getState().move(block.id, { x: at.x, y: at.y, z: at.z });
          proxy.current?.position.set(...centre(at.ok ? { ...block, ...at } : block));
          setPreview(null);
          gizmoBusyUntil = performance.now() + 250;
        }}
      />
      {preview && (preview.x !== block.x || preview.y !== block.y || preview.z !== block.z) && (
        <BlockMesh block={{ ...block, ...preview }} look={preview.ok ? "ghost" : "invalid"} />
      )}
      <HeightGuide block={preview ? { ...block, ...preview } : block} />
    </>
  );
}

/** For a floating block: its shadow on the ground and a line down to it, so you can see how high it is. */
function HeightGuide({ block }: { block: Omit<Block, "id"> }) {
  const [fx, , fz] = footprint(block.piece, block.rot);
  const [cx, , cz] = centre(block);
  const line = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(cx, 0.02, cz), new THREE.Vector3(cx, block.y, cz)]);
    return g;
  }, [cx, cz, block.y]);
  if (block.y <= 0) return null;
  return (
    <group raycast={() => null}>
      <mesh position={[cx, 0.02, cz]} rotation-x={-Math.PI / 2} raycast={() => null}>
        <planeGeometry args={[fx, fz]} />
        <meshBasicMaterial color="#1d2433" transparent opacity={0.22} depthWrite={false} />
      </mesh>
      <lineSegments geometry={line} raycast={() => null}>
        <lineBasicMaterial color="#1d2433" transparent opacity={0.5} />
      </lineSegments>
    </group>
  );
}
