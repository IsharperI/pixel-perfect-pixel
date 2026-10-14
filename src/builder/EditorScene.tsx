import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Grid, OrbitControls, TransformControls } from "@react-three/drei";
import * as THREE from "three";
import { BlockMesh } from "./BlockMesh";
import { Water } from "./Water";
import { useLevel } from "./levelStore";
import { useUI } from "../game/settings";
import { placementFor } from "./placement";
import { BUILD_LIMIT, PIECES, canPaint, canPlace, centre, footprint, type Block } from "./pieces";
import { FACE, rotateFaces } from "../game/climb";
import { blocksInRect, cellRect, fillRect } from "./drag";
import { positionAt, stopCentres } from "./motion";
import { fullTilt } from "./tilt";
import { stopFits } from "./levelStore";

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
  const stopIndex = useLevel((s) => s.stopIndex);
  const drawOn = useLevel((s) => s.draw);
  const touchMode = useUI((s) => s.touchMode);
  // On a touch screen with Draw on, the camera holds still so your finger can draw
  const cameraLocked = touchMode && drawOn && tool !== "select";
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [eraseId, setEraseId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const busy = useRef(false); // a draw/erase/paint stroke is in progress
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
  useEffect(() => { setGhost(null); setEraseId(null); setDrag(null); setPaintHover(null); }, [tool, piece, rot]);

  // ---- Painting vines: which side is under the pointer, and the strokes of a drag in progress
  const [paintHover, setPaintHover] = useState<{ id: string; face: number; add: boolean } | null>(null);
  const [pending, setPending] = useState<Map<string, number> | null>(null);
  const painting = useRef<{ add: boolean; masks: Map<string, number> } | null>(null);

  /** The block side under the pointer, as a face bit in the block's own frame (sides only). */
  const sideFor = (e: ThreeEvent<PointerEvent>) => {
    const hit = blockFromEvent(e, blocks);
    if (!hit || !e.face || !canPaint(hit)) return null;
    const n = e.face.normal.clone().transformDirection(e.object.matrixWorld);
    if (Math.abs(n.y) > 0.5) return null; // only sides can have vines
    const world = Math.abs(n.x) > Math.abs(n.z) ? (n.x > 0 ? FACE.px : FACE.nx) : n.z > 0 ? FACE.pz : FACE.nz;
    return { block: hit, face: rotateFaces(world, 4 - (hit.rot % 4)) };
  };
  const currentMask = (b: Block) => painting.current?.masks.get(b.id) ?? b.vines ?? 0;
  const applyPaint = (b: Block, face: number) => {
    const p = painting.current;
    if (!p) return;
    const m = currentMask(b);
    const next = p.add ? m | face : m & ~face;
    if (next === m) return;
    p.masks.set(b.id, next);
    setPending(new Map(p.masks));
  };

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
    // Touch with Draw off: a finger turns the view instead of drawing. A plain tap reminds you about Draw.
    if (e.pointerType === "touch" && !drawOn && tool !== "select") {
      const x0 = e.nativeEvent.clientX, y0 = e.nativeEvent.clientY;
      const up = (ev: PointerEvent) => {
        window.removeEventListener("pointerup", up);
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 8) useLevel.getState().nudgeDraw();
      };
      window.addEventListener("pointerup", up);
      return;
    }
    if (busy.current) return; // already drawing with another finger
    if (e.button === 0 && tool === "paint") {
      e.stopPropagation();
      const side = sideFor(e);
      if (!side) return;
      // The first side decides: painting a bare side adds vines, a vine-covered one removes them
      painting.current = { add: !((side.block.vines ?? 0) & side.face), masks: new Map() };
      applyPaint(side.block, side.face);
      busy.current = true;
      const up = () => {
        busy.current = false;
        window.removeEventListener("pointerup", up);
        const p = painting.current;
        painting.current = null;
        if (p?.masks.size) useLevel.getState().paintVines(p.masks);
        setPending(null);
      };
      window.addEventListener("pointerup", up);
      return;
    }
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
    busy.current = true;

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
      busy.current = false;
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
    if (tool === "paint") {
      const side = sideFor(e);
      if (side && painting.current) applyPaint(side.block, side.face);
      setPaintHover(side ? { id: side.block.id, face: side.face, add: painting.current ? painting.current.add : !(currentMask(side.block) & side.face) } : null);
      return;
    }
    setGhost(tool === "build" ? ghostFor(e) : null);
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 5 || performance.now() < gizmoBusyUntil) return; // it was a camera drag, or a gizmo click
    // (Build and Erase happen on press/release instead — see onDown)
    if (tool === "select") useLevel.getState().select(blockFromEvent(e, blocks)?.id ?? null);
  };

  const selected = blocks.find((b) => b.id === selectedId) ?? null;
  const drawing = tool === "build" || tool === "erase" || tool === "paint";
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
        enabled={!cameraLocked}
        // Touch: one finger turns the view, two fingers pinch to zoom and drag to slide
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
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

      <group onPointerDown={onDown} onPointerMove={onMove} onPointerOut={() => { setGhost(null); setEraseId(null); setPaintHover(null); }} onClick={onClick}>
        {/* The water you build on (height 0): click it to place blocks */}
        <Water />
        {blocks.map((b) => (
          <BlockMesh
            key={b.id}
            block={pending?.has(b.id) ? { ...b, vines: pending.get(b.id)! } : b}
            editor
            look={b.id === eraseId || erasing?.has(b.id) ? "erase" : "solid"}
            selected={b.id === selectedId && tool === "select" && (!b.move || stopIndex === 0)}
            vinePreview={tool === "paint" && paintHover?.id === b.id ? paintHover : undefined}
          />
        ))}
      </group>

      {tool === "build" && ghost && <BlockMesh block={{ piece, rot, x: ghost.x, y: ghost.y, z: ghost.z }} look={ghost.ok ? "ghost" : "invalid"} />}
      {tool === "build" && ghost && ghost.y > 0 && <HeightGuide block={{ piece, rot, x: ghost.x, y: ghost.y, z: ghost.z }} />}
      {tool === "select" && selected && (
        <MoveGizmo key={`${selected.id}:${stopIndex}`} block={selected} blocks={blocks} stop={selected.move && stopIndex <= selected.move.stops.length ? stopIndex : 0} />
      )}

      {/* Tilting platform (when selected): a see-through copy tipped all the way, rocking gently */}
      {tool === "select" && selected?.tilt && <TiltPreview block={selected} />}

      {/* Moving platforms: their paths, and (when selected) their stops and a preview of the motion */}
      {blocks.filter((b) => b.move).map((b) => (
        <MotionPath key={b.id} block={b} selected={tool === "select" && b.id === selectedId} stopIndex={stopIndex} />
      ))}

      {/* Drag previews */}
      {drag?.kind === "build" && drag.list.map((b, i) => <BlockMesh key={i} block={b} look="ghost" />)}
      {drag?.kind === "build" && drag.start.y > 0 && <HeightGuide block={drag.start} />}
      {drag?.kind === "erase" && <EraseBox rect={drag.rect} y={drag.planeY} />}
    </>
  );
}

/**
 * Drag the selected block along x/y/z with arrows; it snaps to the grid and won't overlap others.
 * For a moving platform, `stop` 1+ moves one of its stops instead (stops may pass through blocks).
 */
function MoveGizmo({ block, blocks, stop }: { block: Block; blocks: Block[]; stop: number }) {
  const proxy = useRef<THREE.Group>(null);
  const [preview, setPreview] = useState<Ghost | null>(null);
  const off = stop > 0 ? block.move!.stops[stop - 1]! : ([0, 0, 0] as const);
  const home = { ...block, x: block.x + off[0], y: block.y + off[1], z: block.z + off[2] };
  const [cx, cy, cz] = centre(home);

  // Put the gizmo at the block's centre (again) whenever the block moves or rotates
  useEffect(() => { proxy.current?.position.set(cx, cy, cz); }, [cx, cy, cz]);

  const snapped = () => {
    const p = proxy.current!.position;
    const [fx, h, fz] = footprint(block.piece, block.rot);
    const at = { x: Math.round(p.x - fx / 2), y: Math.max(0, Math.round(p.y - h / 2)), z: Math.round(p.z - fz / 2) };
    const ok = stop > 0 ? stopFits(block, [at.x - block.x, at.y - block.y, at.z - block.z]) : canPlace({ ...block, ...at }, blocks, block.id);
    return { ...at, ok };
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
          const S = useLevel.getState();
          let moved = false;
          if (at.ok) moved = stop > 0 ? S.moveStop(block.id, stop, [at.x - block.x, at.y - block.y, at.z - block.z]) : S.move(block.id, { x: at.x, y: at.y, z: at.z });
          proxy.current?.position.set(...centre(moved ? { ...block, ...at } : home));
          setPreview(null);
          gizmoBusyUntil = performance.now() + 250;
        }}
      />
      {preview && (preview.x !== home.x || preview.y !== home.y || preview.z !== home.z) && (
        <BlockMesh block={{ ...block, ...preview }} look={preview.ok ? "ghost" : "invalid"} />
      )}
      <HeightGuide block={preview ? { ...block, ...preview } : home} />
    </>
  );
}

/** A see-through copy of a tilting platform rocking out to how far it can tip. */
function TiltPreview({ block }: { block: Block }) {
  const g = useRef<THREE.Group>(null);
  const [ax, az] = fullTilt(block.piece, block.tilt!.max);
  useFrame(({ clock }) => {
    if (!g.current) return;
    const k = Math.sin(clock.elapsedTime * 1.3); // rock from one side to the other
    g.current.rotation.set(ax * k, (block.rot * Math.PI) / 2, az * k, "YXZ");
  });
  const [cx, cy, cz] = centre(block);
  const [w, h, l] = PIECES[block.piece].size;
  return (
    <group ref={g} position={[cx, cy, cz]}>
      <mesh raycast={() => null}>
        <boxGeometry args={[w * 0.98, h * 0.98, l * 0.98]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
}

const PATH_COLOUR = "#c2410c";

/** A moving platform's path as a dotted line. When selected: numbered ghosts at each stop, and a preview. */
function MotionPath({ block, selected, stopIndex }: { block: Block; selected: boolean; stopIndex: number }) {
  const points = useMemo(() => stopCentres(block), [block]);
  const line = useMemo(() => {
    const pts = points.map((p) => new THREE.Vector3(...p));
    if (block.move!.loop && pts.length > 2) pts.push(pts[0]!.clone());
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    return g;
  }, [points, block.move]);
  const lineRef = useRef<THREE.Line>(null);
  useEffect(() => { lineRef.current?.computeLineDistances(); }, [line]);
  const tool = useLevel((s) => s.tool);

  return (
    <group>
      {/* @ts-expect-error -- three's <line> element, not the SVG one */}
      <line ref={lineRef} geometry={line} raycast={() => null}>
        <lineDashedMaterial color={PATH_COLOUR} dashSize={0.25} gapSize={0.18} transparent opacity={selected ? 0.95 : 0.55} depthTest={false} />
      </line>
      {points.map((p, i) => (
        <StopBadge key={i} at={p} n={i + 1} active={selected && i === stopIndex} faint={!selected} />
      ))}
      {selected && points.slice(1).map((p, k) => {
        const i = k + 1;
        const off = block.move!.stops[k]!;
        return (
          <group
            key={i}
            onClick={(e) => {
              if (tool !== "select" || e.delta > 5) return;
              e.stopPropagation();
              useLevel.getState().selectStop(i);
            }}
          >
            <BlockMesh block={{ ...block, id: `${block.id}:stop${i}`, x: block.x + off[0], y: block.y + off[1], z: block.z + off[2] }} look="ghost" />
          </group>
        );
      })}
      {selected && <MotionPreview block={block} points={points} />}
    </group>
  );
}

/** A see-through copy riding along the path, so you can see how it will move. */
function MotionPreview({ block, points }: { block: Block; points: ReturnType<typeof stopCentres> }) {
  const g = useRef<THREE.Group>(null);
  const t = useRef(0);
  useFrame((_, dt) => {
    t.current += Math.min(dt, 0.05);
    const p = positionAt(points, block.move!, t.current);
    g.current?.position.set(p[0] - points[0]![0], p[1] - points[0]![1], p[2] - points[0]![2]);
  });
  return (
    <group ref={g} raycast={() => null}>
      <group raycast={() => null}>
        <PreviewMesh block={block} />
      </group>
    </group>
  );
}

function PreviewMesh({ block }: { block: Block }) {
  const [w, h, l] = footprint(block.piece, 0);
  const [cx, cy, cz] = centre(block);
  return (
    <mesh position={[cx, cy, cz]} rotation-y={(block.rot * Math.PI) / 2} raycast={() => null}>
      <boxGeometry args={[w * 0.96, h * 0.96, l * 0.96]} />
      <meshBasicMaterial color="#fb923c" transparent opacity={0.28} depthWrite={false} />
    </mesh>
  );
}

const badgeTextures = new Map<string, THREE.CanvasTexture>();
/** A round orange badge with a number on it (shared textures). */
function badgeTexture(n: number, active: boolean) {
  const key = `${n}:${active}`;
  let tex = badgeTextures.get(key);
  if (tex) return tex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = active ? "#2563eb" : "#ea580c";
  ctx.beginPath(); ctx.arc(32, 32, 28, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 5; ctx.strokeStyle = "#ffffff"; ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 34px system-ui, sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(String(n), 32, 34);
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  badgeTextures.set(key, tex);
  return tex;
}

/** The stop number, floating above the stop. */
function StopBadge({ at, n, active, faint }: { at: [number, number, number]; n: number; active: boolean; faint: boolean }) {
  const map = useMemo(() => badgeTexture(n, active), [n, active]);
  return (
    <sprite position={[at[0], at[1] + 0.95, at[2]]} scale={faint ? 0.4 : 0.55} raycast={() => null} renderOrder={10}>
      <spriteMaterial map={map} depthTest={false} transparent opacity={faint ? 0.6 : 1} />
    </sprite>
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
