import { useEffect, useId, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, Physics, RigidBody, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { BlockMesh } from "./BlockMesh";
import { Water } from "./Water";
import { useLevel } from "./levelStore";
import { usePlay } from "./playState";
import { flagLocked, hasWon, isPlayground, touchesFlag, touchesStar } from "./rules";
import { saveBestTime, listSavedLevels } from "./levelFile";
import { PIECES, centre, spawnPoint, type Block } from "./pieces";
import { Player } from "../game/Player";
import { useInputListeners } from "../game/input";
import { liveStats, useSettings, bool, num } from "../game/settings";
import { playStar, playTick, playTimeUp, playWin } from "../game/sfx";
import { carriers, type Carrier } from "../game/carriers";
import { positionAt, stopCentres } from "./motion";

/** Play the level: every block becomes solid, and your tuned character starts on the Start pad. */
export function PlayScene() {
  const blocks = useLevel((s) => s.blocks);
  useInputListeners();
  return (
    <Physics timeStep="vary">
      {/* Moving platforms come first, so they've moved before the player works out where to go */}
      {blocks.filter((b) => b.move).map((b) => <PlayMover key={b.id} block={b} />)}
      {blocks.filter((b) => !b.move).map((b) =>
        b.piece === "star" ? <PlayStar key={b.id} block={b} /> : <PlayBlock key={b.id} block={b} />,
      )}
      <Player spawn={spawnPoint(blocks)} fallLimit={-1.2} />
      {/* After the player has moved: put the moving platforms in their new places */}
      <PlatformCommit />
      <Water />
      <GoalWatcher />
    </Physics>
  );
}

function PlayBlock({ block }: { block: Block }) {
  const fadeId = useId(); // lets the camera fade this block when it's in the way
  const isGoal = block.piece === "goal";
  return (
    // Ramps get a collider shaped like the wedge; the flag only has a solid pad (you can run through
    // the pole); everything else is a box
    <RigidBody
      type="fixed"
      colliders={isGoal ? false : PIECES[block.piece].ramp ? "hull" : "cuboid"}
      position={centre(block)}
      rotation={[0, (block.rot * Math.PI) / 2, 0]}
      userData={{ fadeId }}
    >
      {isGoal && <CuboidCollider args={[0.46, 0.1, 0.46]} position={[0, -0.4, 0]} />}
      {isGoal ? <PlayFlag block={block} fadeId={fadeId} /> : <BlockMesh block={block} fadeId={fadeId} local />}
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
      s.carrier = {
        dx: 0, dy: 0, dz: 0, stoodOn: false,
        commit: () => { const q = state.current.last; rb.setTranslation({ x: q[0], y: q[1], z: q[2] }, true); },
      };
      carriers.set(s.handle, s.carrier);
    }
    if (!s.started && s.carrier.stoodOn) s.started = true; // "waits until you step on it"
    if (s.started && !usePlay.getState().won) s.t += Math.min(rawDt, 0.05);
    const p = positionAt(points, block.move!, s.t);
    s.carrier.dx = p[0] - s.last[0];
    s.carrier.dy = p[1] - s.last[1];
    s.carrier.dz = p[2] - s.last[2];
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

/** Each frame: has the player picked up a star, reached the goal, or run out of time? */
function GoalWatcher() {
  const lastTick = useRef(Infinity);
  useFrame(() => {
    const L = useLevel.getState();
    const P = usePlay.getState();
    if (P.won || P.lost) return;
    const S = useSettings.getState().values;
    const volume = bool(S, "sounds") ? num(S, "soundVolume") : 0;
    const p = { x: liveStats.x, y: liveStats.y, z: liveStats.z };
    const r = L.rules;
    const elapsed = performance.now() / 1000 - P.startedAt;

    // Stars can always be collected (in every mode)
    const stars = L.blocks.filter((b) => b.piece === "star");
    for (const s of stars) {
      if (!P.collected.includes(s.id) && touchesStar(p, s)) {
        playStar(volume, P.collected.length);
        P.collect(s.id);
      }
    }
    const collected = usePlay.getState().collected.length;

    const flag = r.flag ? L.blocks.find((b) => b.piece === "goal") : undefined;
    const touchingFlag = !!flag && touchesFlag(p, flag);
    if (touchingFlag && flagLocked(r, collected, stars.length)) {
      const left = stars.length - collected;
      P.showHint(`Collect ${left === 1 ? "the last star" : `all the stars (${left} to go)`} first!`);
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
