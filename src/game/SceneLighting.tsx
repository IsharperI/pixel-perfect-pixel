import { Environment, Lightformer } from "@react-three/drei";
import { isTouchDevice, useQuality } from "./quality";
import { QualityControl } from "./QualityControl";

/** Sky colour, fog, sun with shadows and soft fill light, shared by every 3D scene. */
export function SceneLighting() {
  const shadows = useQuality((q) => q.shadows);
  const size = isTouchDevice() ? 1024 : 2048; // smaller shadow map on tablets and phones
  return (
    <>
      <QualityControl />
      <color attach="background" args={["#bfe3ff"]} />
      <fog attach="fog" args={["#bfe3ff", 45, 110]} />
      <hemisphereLight args={["#ffffff", "#a8d5a2", 0.7]} />
      <directionalLight
        position={[18, 30, 12]}
        intensity={1.8}
        castShadow={shadows}
        shadow-mapSize={[size, size]}
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
    </>
  );
}
