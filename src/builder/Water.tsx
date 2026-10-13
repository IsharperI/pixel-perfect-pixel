import { BUILD_LIMIT } from "./pieces";

/** The water around your level: blocks sit on it, and falling in sends you back to the Start pad. */
export function Water() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[BUILD_LIMIT * 6, BUILD_LIMIT * 6]} />
      <meshStandardMaterial color="#6fbde8" roughness={0.25} metalness={0.05} />
    </mesh>
  );
}
