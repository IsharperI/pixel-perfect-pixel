import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { AnimState } from "./characterModel";

const BODY_HEIGHT = 1.9; // same as the capsule

// Which clip names count for each state (first match wins, case-insensitive)
const CLIP_PATTERNS: Record<AnimState, RegExp[]> = {
  idle: [/idle/i, /stand/i, /breath/i],
  walk: [/walk/i, /run/i, /jog/i],
  run: [/run/i, /sprint/i, /jog/i, /walk/i],
  jump: [/jump/i, /air/i, /fall/i],
  fall: [/fall/i, /air/i, /jump/i],
};

/**
 * A character model loaded from a .glb. Scaled to the capsule's height, centred,
 * feet at the bottom. Plays the model's own idle/walk/run/jump/fall clips if it has
 * them, chosen from `state.current` each frame; `speed.current` speeds up run cycles.
 */
export function CustomModel({ url, state, speed }: { url: string; state: { current: AnimState }; speed: { current: number } }) {
  const gltf = useGLTF(url);
  const root = useRef<THREE.Group>(null);

  // Fit to the body: scale by height, centre on x/z, feet at the bottom of the capsule
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const scale = size.y > 0 ? BODY_HEIGHT / size.y : 1;
    const centre = box.getCenter(new THREE.Vector3());
    return { scale, offset: [-centre.x * scale, -box.min.y * scale - BODY_HEIGHT / 2, -centre.z * scale] as [number, number, number] };
  }, [gltf.scene]);

  // Shadows, and tag the model as "player" in the stencil buffer (for the silhouette)
  useEffect(() => {
    gltf.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.renderOrder = 1;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        m.stencilWrite = true;
        m.stencilRef = 1;
        m.stencilFunc = THREE.AlwaysStencilFunc;
        m.stencilZPass = THREE.ReplaceStencilOp;
      }
    });
  }, [gltf.scene]);

  const { actions, names } = useAnimations(gltf.animations, root);
  const clipFor = useMemo(() => {
    const pick = (s: AnimState) => {
      for (const re of CLIP_PATTERNS[s]) {
        const n = names.find((x) => re.test(x));
        if (n) return n;
      }
      return null;
    };
    return { idle: pick("idle"), walk: pick("walk"), run: pick("run"), jump: pick("jump"), fall: pick("fall") } as Record<AnimState, string | null>;
  }, [names]);

  const playing = useRef<string | null>(null);
  useFrame(() => {
    const want = clipFor[state.current] ?? clipFor.idle ?? names[0] ?? null;
    if (want && want !== playing.current) {
      const next = actions[want];
      const prev = playing.current ? actions[playing.current] : null;
      if (next) {
        next.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.15).play();
        prev?.fadeOut(0.15);
        playing.current = want;
      }
    }
    const a = playing.current ? actions[playing.current] : null;
    if (a) a.timeScale = state.current === "run" || state.current === "walk" ? Math.max(0.5, speed.current) : 1;
  });

  return (
    <group ref={root} scale={fit.scale} position={fit.offset}>
      <primitive object={gltf.scene} />
    </group>
  );
}

/** If the model file can't be loaded, show `fallback` (the capsule) instead of breaking the scene. */
export class ModelErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch(err: unknown) { console.warn("Custom character model failed to load; using the capsule.", err); }
  override render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/**
 * Check a model file is a real .glb (starts with "glTF") before trying to load it,
 * so a broken or mis-named file quietly falls back to the capsule. null = still checking.
 */
export function useGlbCheck(url: string | null): boolean | null {
  const [ok, setOk] = useState<boolean | null>(url ? null : false);
  useEffect(() => {
    if (!url) { setOk(false); return; }
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((buf) => {
        const valid = buf.byteLength > 12 && new TextDecoder().decode(new Uint8Array(buf, 0, 4)) === "glTF";
        if (!valid) console.warn("src/game/models: that file isn't a valid .glb model; using the capsule.");
        if (!cancelled) setOk(valid);
      })
      .catch(() => { if (!cancelled) setOk(false); });
    return () => { cancelled = true; };
  }, [url]);
  return ok;
}
