import { useEffect, useId, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { BlockMesh } from "./BlockMesh";
import { Water } from "./Water";
import { useLevel } from "./levelStore";
import { usePlay } from "./playState";
import { flagLocked, hasWon, isPlayground, touchesBox, touchesFlag, touchesStar } from "./rules";
import { respawn } from "../game/respawn";
import { saveBestTime, listSavedLevels } from "./levelFile";
import { PIECES, bounceHeight, bounds, canPaint, centre, footprint, spawnPoint, standOnPad, type Block } from "./pieces";
import { bouncePads, type Pad } from "../game/bounce";
import { boxFaces, climbFaces, findGrab, rotateFaces } from "../game/climb";
import { Player } from "../game/Player";
import { useInputListeners } from "../game/input";
import { liveStats, useSettings, useUI, bool, num } from "../game/settings";
import { playCheckpoint, playOuch, playStar, playTick, playTimeUp, playWin } from "../game/sfx";
import { carriers, type Carrier } from "../game/carriers";
import { positionAt, stopCentres } from "./motion";
import { LEVEL_RATE, TIP_RATE, approach, tiltTarget, toLocal } from "./tilt";
import { Targets } from "../game/Targets";
import { TARGETS, type Target } from "../game/targets";

/** Pick up a collectable (by walking into it or homing-attacking it). */
function collectStar(id: string) {
  const P = usePlay.getState();
  if (P.won || P.lost || P.collected.includes(id)) return;
  const S = useSettings.getState().values;
  playStar(bool(S, "sounds") ? num(S, "soundVolume") : 0, P.collected.length);
  P.collect(id);
  for (const t of TARGETS as (Target & { blockId?: string })[]) if (t.blockId === id) t.activeAt = Infinity; // gone for this run
}

/** Homing-attackable collectables become lock-on targets (fresh every run). */
function HomingStars({ blocks }: { blocks: Block[] }) {
  const run = usePlay((s) => s.run);
  const list = useMemo(
    () => blocks.filter((b) => b.piece === "star" && b.homing).map((b, id): Target & { blockId: string } => ({
      id, blockId: b.id, pos: new THREE.Vector3(...centre(b)), activeAt: 0, onHit: () => collectStar(b.id),
    })),
    [blocks, run],
  );
  return list.length ? <Targets list={list} orbs={false} /> : null;
}

/** Play the level: every block becomes solid, and your tuned character starts on the Start pad. */
export function PlayScene() {
  const blocks = useLevel((s) => s.blocks);
  useInputListeners();
  return (
    <Physics timeStep="vary">
      {/* Moving platforms come first, so they've moved before the player works out where to go */}
      {blocks.filter((b) => b.move).map((b) => <PlayMover key={b.id} block={b} />)}
      {blocks.filter((b) => b.tilt).map((b) => <PlayTilter key={b.id} block={b} />)}
      {blocks.filter((b) => !b.move && !b.tilt).map((b) =>
        b.piece === "star" ? <PlayStar key={b.id} block={b} /> : <PlayBlock key={b.id} block={b} />,
      )}
      <Player spawn={spawnPoint(blocks)} fallLimit={-1.2} />
      {/* After the player has moved: put the moving platforms in their new places */}
      <PlatformCommit />
      <Water />
      <ClimbWalls blocks={blocks} />
      <GoalWatcher />
      <HomingStars blocks={blocks} />
    </Physics>
  );
}

function PlayBlock({ block }: { block: Block }) {
  const fadeId = useId(); // lets the camera fade this block when it's in the way
  const isGoal = block.piece === "goal";
  const isPad = block.piece === "bounce";
  const isCheckpoint = block.piece === "checkpoint";
  const lit = usePlay((s) => s.checkpoint === block.id);
  // Bounce pads: let the player know where they are
  useEffect(() => {
    if (!isPad) return;
    const pad: Pad = { id: block.id, x: block.x + 0.5, z: block.z + 0.5, top: block.y + 0.28, hx: 0.46, hz: 0.46, height: bounceHeight(block), boingAt: -Infinity };
    bouncePads.push(pad);
    return () => { const i = bouncePads.indexOf(pad); if (i >= 0) bouncePads.splice(i, 1); };
  }, [isPad, block]);
  return (
    // Ramps get a collider shaped like the wedge; the flag only has a solid pad (you can run through
    // the pole); everything else is a box
    <RigidBody
      type="fixed"
      colliders={isGoal || isPad || isCheckpoint ? false : PIECES[block.piece].ramp ? "hull" : "cuboid"}
      position={centre(block)}
      rotation={[0, (block.rot * Math.PI) / 2, 0]}
      userData={{ fadeId }}
    >
      {isGoal && <CuboidCollider args={[0.46, 0.1, 0.46]} position={[0, -0.4, 0]} />}
      {isPad && <CuboidCollider args={[0.46, 0.14, 0.46]} position={[0, -0.36, 0]} />}
      {isCheckpoint && <CuboidCollider args={[0.46, 0.08, 0.46]} position={[0, -0.42, 0]} />}
      {isGoal ? <PlayFlag block={block} fadeId={fadeId} /> : <BlockMesh block={block} fadeId={fadeId} local {...(isCheckpoint ? { lit } : {})} />}
    </RigidBody>
  );
}

/** A moving platform: follows its stops, and carries the player standing on it. */
function PlayMover({ block }: { block: Block }) {
  const fadeId = useId();
  const body = useRef<RapierRigidBody>(null);
  const points = useMemo(() => stopCentres(block), [block]);
  const size = PIECES[block.piece].size; // unrotated: the body itself is rotated
  const state = useRef({ t: 0, started: block.move!.trigger === "always", last: points[0]!, carrier: null as Carrier | null, handle: -1 });

  // Stop carrying the player when this platform goes away
  useEffect(() => () => { if (state.current.handle >= 0) carriers.delete(state.current.handle); }, []);

  useFrame((_, rawDt) => {
    const rb = body.current, s = state.current;
    if (!rb) return;
    // Register as something that carries the player, once its collider exists
    // (colliders are added a moment after the body appears)
    if (!s.carrier) {
      if (rb.numColliders() === 0) return;
      s.handle = rb.collider(0).handle;
      const [fx, fh, fz] = footprint(block.piece, block.rot);
      const at = points[0]!;
      s.carrier = {
        handle: s.handle,
        dx: 0, dy: 0, dz: 0,
        x: at[0], y: at[1], z: at[2], hx: fx / 2, hy: fh / 2, hz: fz / 2,
        nx: 0, ny: 1, nz: 0,
        stoodOn: false,
        commit: () => {
          const c = s.carrier!;
          if (!c.dx && !c.dy && !c.dz) return; // not moving: leave it be
          const q = state.current.last;
          rb.setTranslation({ x: q[0], y: q[1], z: q[2] }, true);
        },
      };
      carriers.set(s.handle, s.carrier);
    }
    if (!s.started && s.carrier.stoodOn) s.started = true; // "waits until you step on it"
    if (s.started && !usePlay.getState().won) s.t += Math.min(rawDt, 0.05);
    const p = positionAt(points, block.move!, s.t);
    s.carrier.dx = p[0] - s.last[0];
    s.carrier.dy = p[1] - s.last[1];
    s.carrier.dz = p[2] - s.last[2];
    s.carrier.x = p[0]; s.carrier.y = p[1]; s.carrier.z = p[2];
    s.carrier.stoodOn = false; // the player sets this again each frame they're on it
    s.last = p;
  });

  return (
    <RigidBody
      ref={body}
      type="kinematicPosition" // placed by hand each frame (see carriers.ts)
      colliders={false}
      position={points[0]}
      rotation={[0, (block.rot * Math.PI) / 2, 0]}
      userData={{ fadeId }}
    >
      {/* Exactly one collider, so the player always recognises what they're standing on */}
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
      <BlockMesh block={block} fadeId={fadeId} local />
    </RigidBody>
  );
}

/** A seesaw platform: tips toward where the player stands on it, and levels out when they step off. */
function PlayTilter({ block }: { block: Block }) {
  const fadeId = useId();
  const body = useRef<RapierRigidBody>(null);
  const at = useMemo(() => centre(block), [block]);
  const size = PIECES[block.piece].size;
  const state = useRef({ ax: 0, az: 0, carrier: null as Carrier | null, handle: -1 });
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), e: new THREE.Euler(), n: new THREE.Vector3() }), []);

  useEffect(() => () => { if (state.current.handle >= 0) carriers.delete(state.current.handle); }, []);

  useFrame((_, rawDt) => {
    const rb = body.current, s = state.current;
    if (!rb) return;
    if (!s.carrier) {
      if (rb.numColliders() === 0) return;
      s.handle = rb.collider(0).handle;
      const [fx, fh, fz] = footprint(block.piece, block.rot);
      s.carrier = {
        handle: s.handle, dx: 0, dy: 0, dz: 0,
        x: at[0], y: at[1], z: at[2], hx: fx / 2, hy: fh / 2, hz: fz / 2,
        nx: 0, ny: 1, nz: 0, stoodOn: false,
        commit: () => { rb.setRotation(tmp.q, true); },
      };
      carriers.set(s.handle, s.carrier);
    }
    const c = s.carrier;
    const dt = Math.min(rawDt, 0.05);
    // Where is the player on it (in the platform's own frame)? Tip toward them; level out when they leave
    let tx = 0, tz = 0, rate = LEVEL_RATE;
    if (c.stoodOn) {
      const [lx, lz] = toLocal(liveStats.x - at[0], liveStats.z - at[2], block.rot);
      [tx, tz] = tiltTarget(block.piece, lx, lz, block.tilt?.max);
      rate = TIP_RATE;
    }
    s.ax = approach(s.ax, tx, rate, dt);
    s.az = approach(s.az, tz, rate, dt);
    // Turn = face its building direction, then tip about its own x and z
    tmp.q.setFromEuler(tmp.e.set(s.ax, (block.rot * Math.PI) / 2, s.az, "YXZ"));
    tmp.n.set(0, 1, 0).applyQuaternion(tmp.q);
    c.nx = tmp.n.x; c.ny = tmp.n.y; c.nz = tmp.n.z;
    c.stoodOn = false; // the player sets this again each frame they're on it
  });

  return (
    <RigidBody ref={body} type="kinematicPosition" colliders={false} position={at} rotation={[0, (block.rot * Math.PI) / 2, 0]} userData={{ fadeId }}>
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
      <BlockMesh block={block} fadeId={fadeId} local />
    </RigidBody>
  );
}

/** Lets the player climb painted vines: lists every vine-covered side while the level is played. */
function ClimbWalls({ blocks }: { blocks: Block[] }) {
  useEffect(() => {
    const faces = blocks
      .filter((b) => b.vines && canPaint(b))
      .flatMap((b) => { const { min, max } = bounds(b); return boxFaces(min, max, rotateFaces(b.vines!, b.rot)); });
    climbFaces.push(...faces);
    return () => { climbFaces.length = 0; };
  }, [blocks]);
  return null;
}

/** Runs after the player each frame: places every moving platform at its new position. */
function PlatformCommit() {
  useFrame(() => { for (const c of carriers.values()) c.commit(); });
  return null;
}

/** The goal flag: locked (grey, with a padlock) until every star is collected, when the rules say so. */
function PlayFlag({ block, fadeId }: { block: Block; fadeId: string }) {
  const rules = useLevel((s) => s.rules);
  const total = useLevel((s) => s.blocks.filter((b) => b.piece === "star").length);
  const collected = usePlay((s) => s.collected.length);
  const locked = flagLocked(rules, collected, total);
  return <BlockMesh block={block} fadeId={fadeId} local locked={locked} />;
}

/** A star you can collect: when touched it pops (grows and vanishes). */
function PlayStar({ block }: { block: Block }) {
  const got = usePlay((s) => s.collected.includes(block.id));
  const group = useRef<THREE.Group>(null);
  const popT = useRef(0);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    if (!got) { popT.current = 0; g.visible = true; g.scale.setScalar(1); return; }
    popT.current += dt;
    const t = popT.current / 0.25;
    g.visible = t < 1;
    g.scale.setScalar(1 + t * 0.8);
    g.position.y = centre(block)[1] + t * 0.6;
  });
  return (
    <group ref={group} position={centre(block)}>
      <BlockMesh block={block} local />
    </group>
  );
}

/** Each frame: has the player picked up a collectable, reached the goal, or run out of time? */
function GoalWatcher() {
  const lastTick = useRef(Infinity);
  const elapsedSinceOuch = useRef(-Infinity); // when lava last sent you back (so it only happens once per touch)
  // Leaving Play: forget checkpoints
  useEffect(() => () => { respawn.point = null; respawn.requested = false; }, []);
  useFrame(() => {
    const L = useLevel.getState();
    const P = usePlay.getState();
    if (P.won || P.lost) return;
    const S = useSettings.getState().values;
    const volume = bool(S, "sounds") ? num(S, "soundVolume") : 0;
    const p = { x: liveStats.x, y: liveStats.y, z: liveStats.z };
    const r = L.rules;
    const elapsed = performance.now() / 1000 - P.startedAt;

    // Next to vines (and not climbing yet)? A reminder of how to grab on
    if (bool(S, "climbing") && liveStats.move !== "climbing" && climbFaces.length && findGrab(p.x, p.y, p.z)) {
      P.showHint(useUI.getState().touchMode ? "Tap Grab to climb the vines" : "Press E to climb the vines");
    }

    // Checkpoints: touch one to come back there after a fall
    for (const cp of L.blocks) {
      if (cp.piece !== "checkpoint" || P.checkpoint === cp.id || !touchesFlag(p, cp)) continue;
      P.reachCheckpoint(cp.id, standOnPad(cp));
      playCheckpoint(volume);
      P.showHint("Checkpoint!");
    }
    // Lava: back to the last checkpoint (or the start)
    if (elapsedSinceOuch.current < performance.now() / 1000 - 0.6) {
      for (const lv of L.blocks) {
        if (lv.piece !== "lava" || !touchesBox(p, bounds(lv))) continue;
        respawn.requested = true;
        elapsedSinceOuch.current = performance.now() / 1000;
        playOuch(volume);
        P.showHint(usePlay.getState().checkpoint ? "Ouch! Back to the checkpoint" : "Ouch! Back to the start");
        break;
      }
    }

    // Stars can always be collected (in every mode)
    const stars = L.blocks.filter((b) => b.piece === "star");
    for (const s of stars) {
      if (!P.collected.includes(s.id) && touchesStar(p, s)) collectStar(s.id);
    }
    const collected = usePlay.getState().collected.length;

    const flag = r.flag ? L.blocks.find((b) => b.piece === "goal") : undefined;
    const touchingFlag = !!flag && touchesFlag(p, flag);
    if (touchingFlag && flagLocked(r, collected, stars.length)) {
      const left = stars.length - collected;
      P.showHint(`Collect ${left === 1 ? "the last collectable" : `all the collectables (${left} to go)`} first!`);
    }

    if (hasWon(r, { touchingFlag, collected, totalStars: stars.length })) {
      // Finished! With a stopwatch, keep the best time (in the saved level too, if it's been saved)
      let newBest = false;
      if (r.clock === "trial" && (L.bestTime === null || elapsed < L.bestTime)) {
        newBest = L.bestTime !== null;
        L.setBestTime(elapsed);
        if (listSavedLevels().some((s) => s.id === L.levelId)) saveBestTime(L.levelId, elapsed);
      }
      playWin(volume);
      P.win(elapsed, newBest);
      return;
    }

    if (r.clock === "countdown" && !isPlayground(r)) {
      const left = r.limit - elapsed;
      // Tick each second for the last five
      const whole = Math.ceil(left);
      if (whole <= 5 && whole > 0 && whole < lastTick.current) playTick(volume);
      lastTick.current = whole;
      if (left <= 0) {
        playTimeUp(volume);
        P.lose();
      }
    }
  });
  return null;
}
