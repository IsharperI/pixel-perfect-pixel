import { Environment, Lightformer } from "@react-three/drei";

/** Sky colour, fog, sun with shadows and soft fill light, shared by every 3D scene. */
export function SceneLighting() {
  return (
    <>
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
    </>
  );
}
