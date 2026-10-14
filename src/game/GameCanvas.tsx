import { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { Level } from "./Level";
import { SceneLighting } from "./SceneLighting";
import { Player } from "./Player";
import { useInputListeners } from "./input";
import { SettingsPanel } from "./SettingsPanel";
import { ControlsBar, DebugOverlay } from "./DebugOverlay";
import { CharacterRibbonTools } from "./CharacterRibbonTools";
import { useUI } from "./settings";
import { Tutorial } from "./TutorialOverlay";
import { AppRibbon } from "../components/AppRibbon";
import { SpeedLines } from "./SpeedLines";
import { TouchControls } from "./TouchControls";
import { useQuality } from "./quality";

export function GameCanvas() {
  const dpr = useQuality((q) => q.dpr);
  useInputListeners();
  // Open clean, with just the game: Show UI (or starting the tutorial) brings the windows in
  useEffect(() => { useUI.setState({ hideUI: true }); }, []);
  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      <AppRibbon tools={<CharacterRibbonTools />} />
      {/* The game area: overlays position themselves inside this, below the ribbon */}
      <div className="relative flex-1 overflow-hidden">
      {/* stencil: used to tell "level in front of the player" from "the player's own hand in front" for the silhouette */}
      <Canvas shadows dpr={dpr} gl={{ stencil: true }} camera={{ position: [0, 5, 14], fov: 60 }}>
        <SceneLighting />
        <Suspense fallback={null}>
          <Physics timeStep="vary">
            <Level />
            <Player />
          </Physics>
        </Suspense>
      </Canvas>
      <SpeedLines />
      <TouchControls />
      <DebugOverlay />
      <ControlsBar />
      <SettingsPanel />
      <Tutorial />
      </div>
    </div>
  );
}
