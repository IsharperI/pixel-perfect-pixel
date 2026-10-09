import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { Level } from "./Level";
import { Player } from "./Player";
import { useInputListeners } from "./input";
import { SettingsPanel } from "./SettingsPanel";
import { DebugOverlay } from "./DebugOverlay";
import { Tutorial } from "./TutorialOverlay";
import { AppRibbon } from "../components/AppRibbon";

export function GameCanvas() {
  useInputListeners();
  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <AppRibbon />
      {/* The game area: overlays position themselves inside this, below the ribbon */}
      <div className="relative flex-1 overflow-hidden">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 5, 14], fov: 60 }}>
        <color attach="background" args={["#bfe3ff"]} />
        <fog attach="fog" args={["#bfe3ff", 45, 110]} />
        <hemisphereLight args={["#ffffff", "#a8d5a2", 0.7]} />
        <directionalLight
          position={[18, 30, 12]}
          intensity={1.8}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={40}
          shadow-camera-bottom={-40}
          shadow-bias={-0.0005}
        />
        <Environment>
          <Lightformer intensity={1.5} position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
          <Lightformer intensity={0.8} color="#ffe2c4" position={[-8, 2, -2]} rotation-y={Math.PI / 2} scale={[20, 2, 1]} />
        </Environment>
        <Suspense fallback={null}>
          <Physics timeStep="vary">
            <Level />
            <Player />
          </Physics>
        </Suspense>
      </Canvas>
      <DebugOverlay />
      <SettingsPanel />
      <Tutorial />
      </div>
    </div>
  );
}
