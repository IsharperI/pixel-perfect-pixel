import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import { useUI } from "./settings";
import { usePhone } from "./usePhone";

/**
 * Phones: when the bottom drawer is open, slide the picture up so the character
 * stays in view above it (instead of hiding behind the drawer).
 */
export function CameraLift() {
  const phone = usePhone();
  const phoneRef = useRef(phone);
  useEffect(() => { phoneRef.current = phone; }, [phone]);
  const lift = useRef(0);
  useFrame(({ camera, size }) => {
    const u = useUI.getState();
    const want = phoneRef.current && u.panelOpen && !u.hideUI ? (u.drawerTall ? 0.36 : 0.24) : 0;
    lift.current += (want - lift.current) * 0.15;
    const cam = camera as THREE.PerspectiveCamera;
    if (lift.current < 0.002 && want === 0) {
      if (cam.view?.enabled) cam.clearViewOffset();
      return;
    }
    cam.setViewOffset(size.width, size.height, 0, size.height * lift.current, size.width, size.height);
  });
  return null;
}
