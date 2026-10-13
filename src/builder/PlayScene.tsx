import { useId, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { BlockMesh } from "./BlockMesh";
import { Water } from "./Water";
import { useLevel } from "./levelStore";
import { usePlay } from "./playState";
import { touchesFlag, touchesStar, usesFlag } from "./rules";
import { saveBestTime, listSavedLevels } from "./levelFile";
import { PIECES, centre, spawnPoint, type Block } from "./pieces";
import { Player } from "../game/Player";
import { useInputListeners } from "../game/input";
import { liveStats, useSettings, bool, num } from "../game/settings";
import { playStar, playWin } from "../game/sfx";

/** Play the level: every block becomes solid, and your tuned character starts on the Start pad. */
export function PlayScene() {
  const blocks = useLevel((s) => s.blocks);
  useInputListeners();
  return (
    <Physics timeStep="vary">
      {blocks.map((b) =>
        b.piece === "star" ? <PlayStar key={b.id} block={b} /> : <PlayBlock key={b.id} block={b} />,
      )}
      <Player spawn={spawnPoint(blocks)} fallLimit={-1.2} />
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
      <BlockMesh block={block} fadeId={fadeId} local />
    </RigidBody>
  );
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

/** Each frame: has the player picked up a star, or reached the goal? */
function GoalWatcher() {
  useFrame(() => {
    const L = useLevel.getState();
    const P = usePlay.getState();
    if (P.won) return;
    const S = useSettings.getState().values;
    const volume = bool(S, "sounds") ? num(S, "soundVolume") : 0;
    const p = { x: liveStats.x, y: liveStats.y, z: liveStats.z };

    const stars = L.blocks.filter((b) => b.piece === "star");
    for (const s of stars) {
      if (!P.collected.includes(s.id) && touchesStar(p, s)) {
        playStar(volume, P.collected.length);
        P.collect(s.id);
      }
    }

    const collected = usePlay.getState().collected.length;
    const flag = L.blocks.find((b) => b.piece === "goal");
    const done =
      (usesFlag(L.goal) && flag && touchesFlag(p, flag)) ||
      (L.goal === "stars" && stars.length > 0 && collected >= stars.length);
    if (!done) return;

    // Finished! For a time trial, keep the best time (in the saved level too, if it's been saved)
    const time = performance.now() / 1000 - P.startedAt;
    let newBest = false;
    if (L.goal === "time" && (L.bestTime === null || time < L.bestTime)) {
      newBest = L.bestTime !== null;
      L.setBestTime(time);
      if (listSavedLevels().some((s) => s.id === L.levelId)) saveBestTime(L.levelId, time);
    }
    playWin(volume);
    P.win(time, newBest);
  });
  return null;
}
