import { useEffect, useMemo, useRef, useState } from "react";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Grid, OrbitControls, TransformControls } from "@react-three/drei";
import * as THREE from "three";
import { BlockMesh } from "./BlockMesh";
import { Water } from "./Water";
import { useLevel } from "./levelStore";
import { placementFor } from "./placement";
import { BUILD_LIMIT, canPlace, centre, footprint, type Block } from "./pieces";
import { blocksInRect, cellRect, fillRect } from "./drag";

// The editor camera is remembered across Play sessions, so stopping play returns you to the same view
const savedView = { pos: new THREE.Vector3(9, 11, 14), target: new THREE.Vector3(0, 1, -2) };
// Set while the move gizmo is being used, so that click doesn't also select/deselect blocks
let gizmoBusyUntil = 0;

type Ghost = { x: number; y: number; z: number; ok: boolean };

/** A drag in progress: drawing a rectangle of pieces, or erasing one. */
type Drag =
  | { kind: "build"; start: Omit<Block, "id">; planeY: number; list: Omit<Block, "id">[] }
  | { kind: "erase"; ax: number; az: number; layer: number; planeY: number; firstId: string | null; rect: ReturnType<typeof cellRect>; ids: string[] };

// How far (in pixels) the mouse must move before a press counts as a drag
const DRAG_START = 4;

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
  const [drag, setDrag] = useState<Drag | null>(null);
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const { camera, gl } = useThree();

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

  // Clear hover previews (and any drag) when switching tools or pieces
  useEffect(() => { setGhost(null); setEraseId(null); setDrag(null); }, [tool, piece, rot]);

  /** Where the mouse points on the flat level y = planeY. */
  const pointOnLevel = (clientX: number, clientY: number, planeY: number) => {
    const r = gl.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY), hit) ? hit : null;
  };

  // Press the left button to start drawing (Build) or erasing (Erase); the drag follows the
  // mouse anywhere on screen and everything is added/removed when the button is let go.
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0 || (tool !== "build" && tool !== "erase")) return;
    e.stopPropagation();
    const downX = e.nativeEvent.clientX, downY = e.nativeEvent.clientY;
    let current: Drag;
    if (tool === "build") {
      // Work out the spot from this press itself (the hover preview may not have caught up yet)
      const ghost = ghostFor(e);
      if (!ghost) return;
      const start = { piece, rot, x: ghost.x, y: ghost.y, z: ghost.z };
      current = { kind: "build", start, planeY: ghost.y, list: ghost.ok ? [start] : [] };
    } else {
      const hit = blockFromEvent(e, blocks);
      // The cell just inside the surface that was clicked
      const n = e.face ? e.face.normal.clone().transformDirection(e.object.matrixWorld) : new THREE.Vector3(0, 1, 0);
      const inside = e.point.clone().addScaledVector(n, -0.01);
      const layer = hit ? Math.max(hit.y, Math.min(Math.floor(inside.y), hit.y + footprint(hit.piece, hit.rot)[1] - 1)) : 0;
      const rect = cellRect(inside.x, inside.z, inside.x, inside.z);
      current = { kind: "erase", ax: inside.x, az: inside.z, layer, planeY: hit ? layer + 1 : 0, firstId: hit?.id ?? null, rect, ids: hit ? [hit.id] : [] };
    }
    setDrag(current);
    setGhost(null);
    setEraseId(null);

    let moved = false;
    const onPointerMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - downX, ev.clientY - downY) < DRAG_START) return;
      moved = true;
      const p = pointOnLevel(ev.clientX, ev.clientY, current.planeY);
      if (!p) return;
      const all = useLevel.getState().blocks;
      if (current.kind === "build") {
        current = { ...current, list: fillRect(current.start, p.x, p.z, all) };
      } else {
        const rect = cellRect(current.ax, current.az, p.x, p.z);
        const ids = blocksInRect(rect, current.layer, all).map((b) => b.id);
        if (current.firstId && !ids.includes(current.firstId)) ids.push(current.firstId);
        current = { ...current, rect, ids };
      }
      setDrag(current);
    };
    const finish = (commit: boolean) => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
      setDrag(null);
      if (!commit) return;
      const S = useLevel.getState();
      if (current.kind === "build") S.placeMany(current.list);
      else S.removeMany(current.ids);
    };
    const onUp = (ev: PointerEvent) => { if (ev.button === 0) finish(true); };
    const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") { ev.stopPropagation(); finish(false); } };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey, true);
  };

  /** Where the next piece would go for the surface under the pointer. */
  const ghostFor = (e: ThreeEvent<PointerEvent>): Ghost | null => {
    if (!e.face) return null;
    const n = e.face.normal.clone().transformDirection(e.object.matrixWorld);
    const at = placementFor(blockFromEvent(e, blocks), e.point, n, piece, rot);
    return { ...at, ok: canPlace({ piece, rot, ...at }, blocks) };
  };

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation(); // only the nearest surface counts
    if (drag) return;
    if (tool === "erase") { setEraseId(blockFromEvent(e, blocks)?.id ?? null); return; }
    setGhost(tool === "build" ? ghostFor(e) : null);
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 5 || performance.now() < gizmoBusyUntil) return; // it was a camera drag, or a gizmo click
    // (Build and Erase happen on press/release instead — see onDown)
    if (tool === "select") useLevel.getState().select(blockFromEvent(e, blocks)?.id ?? null);
  };

  const selected = blocks.find((b) => b.id === selectedId) ?? null;
  const drawing = tool === "build" || tool === "erase";
  const erasing = drag?.kind === "erase" ? new Set(drag.ids) : null;

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
        // Building and erasing use the left button to draw, so the view turns with the right button there
        mouseButtons={drawing
          ? { MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE } // no LEFT: it does nothing to the camera
          : { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
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

      <group onPointerDown={onDown} onPointerMove={onMove} onPointerOut={() => { setGhost(null); setEraseId(null); }} onClick={onClick}>
        {/* The water you build on (height 0): click it to place blocks */}
        <Water />
        {blocks.map((b) => (
          <BlockMesh key={b.id} block={b} editor look={b.id === eraseId || erasing?.has(b.id) ? "erase" : "solid"} selected={b.id === selectedId && tool === "select"} />
        ))}
      </group>

      {tool === "build" && ghost && <BlockMesh block={{ piece, rot, x: ghost.x, y: ghost.y, z: ghost.z }} look={ghost.ok ? "ghost" : "invalid"} />}
      {tool === "build" && ghost && ghost.y > 0 && <HeightGuide block={{ piece, rot, x: ghost.x, y: ghost.y, z: ghost.z }} />}
      {tool === "select" && selected && <MoveGizmo block={selected} blocks={blocks} />}

      {/* Drag previews */}
      {drag?.kind === "build" && drag.list.map((b, i) => <BlockMesh key={i} block={b} look="ghost" />)}
      {drag?.kind === "build" && drag.start.y > 0 && <HeightGuide block={drag.start} />}
      {drag?.kind === "erase" && <EraseBox rect={drag.rect} y={drag.planeY} />}
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

/** The red box you drag out when erasing an area. */
function EraseBox({ rect, y }: { rect: ReturnType<typeof cellRect>; y: number }) {
  const w = rect.x1 - rect.x0 + 1, d = rect.z1 - rect.z0 + 1;
  return (
    <mesh position={[rect.x0 + w / 2, y + 0.03, rect.z0 + d / 2]} rotation-x={-Math.PI / 2} raycast={() => null}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial color="#ff4d4d" transparent opacity={0.28} depthWrite={false} />
    </mesh>
  );
}
