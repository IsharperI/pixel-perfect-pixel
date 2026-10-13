import { useId } from "react";
import { Physics, RigidBody } from "@react-three/rapier";
import { BlockMesh } from "./BlockMesh";
import { Water } from "./Water";
import { useLevel } from "./levelStore";
import { PIECES, centre, spawnPoint, type Block } from "./pieces";
import { Player } from "../game/Player";
import { useInputListeners } from "../game/input";

/** Play the level: every block becomes solid, and your tuned character starts on the Start pad. */
export function PlayScene() {
  const blocks = useLevel((s) => s.blocks);
  useInputListeners();
  return (
    <Physics timeStep="vary">
      {blocks.map((b) => <PlayBlock key={b.id} block={b} />)}
      <Player spawn={spawnPoint(blocks)} fallLimit={-1.2} />
      <Water />
    </Physics>
  );
}

function PlayBlock({ block }: { block: Block }) {
  const fadeId = useId(); // lets the camera fade this block when it's in the way
  return (
    // Ramps get a collider shaped like the wedge; everything else is a box
    <RigidBody
      type="fixed"
      colliders={PIECES[block.piece].ramp ? "hull" : "cuboid"}
      position={centre(block)}
      rotation={[0, (block.rot * Math.PI) / 2, 0]}
      userData={{ fadeId }}
    >
      <BlockMesh block={block} fadeId={fadeId} local />
    </RigidBody>
  );
}
