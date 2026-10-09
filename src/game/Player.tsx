import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody, type RapierCollider } from "@react-three/rapier";
import * as THREE from "three";
import { useSettings, num, bool, deriveJump, liveStats, useUI } from "./settings";
import { input, readMove } from "./input";

export const SPAWN = new THREE.Vector3(0, 2, 6);
const RADIUS = 0.45;
const HALF = 0.5; // capsule half-height of the cylinder part
const TRAIL_MAX = 3000;

const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export function Player() {
  const body = useRef<RapierRigidBody>(null);
  const collider = useRef<RapierCollider>(null);
  const visual = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const { world, rapier } = useRapier();
  const { camera, gl } = useThree();

  const st = useRef({
    vel: new THREE.Vector3(),
    facing: Math.PI,
    grounded: false,
    lastGroundedAt: -Infinity,
    jumping: false,
    camYaw: 0,
    camPitch: 0,
    camTarget: SPAWN.clone(),
    lastPos: SPAWN.clone(), // player position last frame, for the leash camera
    wasAirborne: false,
  });

  const controller = useMemo(() => {
    const c = world.createCharacterController(0.02);
    c.enableSnapToGround(0.3);
    c.enableAutostep(0.3, 0.2, true);
    c.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    c.setMinSlopeSlideAngle((55 * Math.PI) / 180);
    c.setApplyImpulsesToDynamicBodies(true);
    return c;
  }, [world]);
  useEffect(() => () => world.removeCharacterController(controller), [world, controller]);

  // Trail points
  const trail = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3));
    g.setDrawRange(0, 0);
    const attr = g.getAttribute("position") as THREE.BufferAttribute;
    return { geo: g, attr, count: 0, acc: 0 };
  }, []);
  // Ghost: a faded copy of the previous jump arc, for before/after comparison
  const ghost = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL_MAX * 3), 3));
    g.setDrawRange(0, 0);
    const attr = g.getAttribute("position") as THREE.BufferAttribute;
    return { geo: g, attr };
  }, []);
  /** Start a fresh arc, keeping the old one as the ghost if it was a real arc. */
  const archiveTrail = () => {
    if (trail.count > 4) {
      (ghost.attr.array as Float32Array).set((trail.attr.array as Float32Array).subarray(0, trail.count * 3));
      ghost.attr.needsUpdate = true;
      ghost.geo.setDrawRange(0, trail.count);
    }
    trail.count = 0;
  };
  const showTrail = useUI((s) => s.showTrail);
  const showGhost = useUI((s) => s.showGhost);

  // Mouse-drag orbit
  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    const downH = (e: PointerEvent) => { dragging = true; el.setPointerCapture(e.pointerId); };
    const upH = (e: PointerEvent) => { dragging = false; el.releasePointerCapture?.(e.pointerId); };
    const moveH = (e: PointerEvent) => {
      if (!dragging) return;
      input.orbitDX += e.movementX;
      input.orbitDY += e.movementY;
      input.lastOrbitAt = performance.now() / 1000;
    };
    el.addEventListener("pointerdown", downH);
    window.addEventListener("pointerup", upH);
    window.addEventListener("pointermove", moveH);
    return () => {
      el.removeEventListener("pointerdown", downH);
      window.removeEventListener("pointerup", upH);
      window.removeEventListener("pointermove", moveH);
    };
  }, [gl]);

  const tmp = useMemo(() => ({ v: new THREE.Vector3(), look: new THREE.Vector3() }), []);

  useFrame((_, rawDt) => {
    const b = body.current, c = collider.current;
    if (!b || !c) { return; }
    step(b, c, rawDt);
  });
  const step = (b: RapierRigidBody, c: RapierCollider, rawDt: number) => {
    const dt = Math.min(rawDt, 0.05);
    const now = performance.now() / 1000;
    const S = useSettings.getState().values;
    const s = st.current;
    const mv = readMove();

    // ---- camera orbit input
    s.camYaw -= input.orbitDX * 0.005 + mv.camX * 2.5 * dt;
    s.camPitch = THREE.MathUtils.clamp(s.camPitch + input.orbitDY * 0.004 + mv.camY * 1.5 * dt, -0.6, 1.2);
    input.orbitDX = input.orbitDY = 0;
    if (Math.abs(mv.camX) > 0 || Math.abs(mv.camY) > 0) input.lastOrbitAt = now;

    // ---- horizontal movement, camera-relative
    const fx = -Math.sin(s.camYaw), fz = -Math.cos(s.camYaw);
    const rx = Math.cos(s.camYaw), rz = -Math.sin(s.camYaw);
    const dx = fx * mv.y + rx * mv.x;
    const dz = fz * mv.y + rz * mv.x;
    const hasInput = Math.hypot(dx, dz) > 0.01;
    const maxSpeed = num(S, "maxSpeed");
    const tx = dx * maxSpeed, tz = dz * maxSpeed;
    const airMul = s.grounded ? 1 : num(S, "airControl");
    const rate = (hasInput ? num(S, "acceleration") : num(S, "deceleration")) * airMul;
    const ex = tx - s.vel.x, ez = tz - s.vel.z;
    const el = Math.hypot(ex, ez);
    const accelStep = rate * dt;
    if (el <= accelStep) { s.vel.x = tx; s.vel.z = tz; }
    else { s.vel.x += (ex / el) * accelStep; s.vel.z += (ez / el) * accelStep; }

    // ---- jump & gravity
    const { gravity, jumpVelocity } = deriveJump(num(S, "jumpHeight"), num(S, "timeToApex"));
    const canCoyote = now - s.lastGroundedAt <= num(S, "coyoteTime");
    const buffered = now - input.jumpPressedAt <= Math.max(num(S, "jumpBuffer"), dt);
    if (buffered && (s.grounded || canCoyote) && !s.jumping) {
      s.vel.y = jumpVelocity;
      s.jumping = true;
      s.grounded = false;
      s.lastGroundedAt = -Infinity;
      input.jumpPressedAt = -Infinity;
      archiveTrail(); // fresh arc; previous one becomes the ghost
    }
    let g = gravity;
    if (s.vel.y < 0) g *= num(S, "fallGravityMultiplier");
    else if (s.vel.y > 0 && bool(S, "variableJumpHeight") && !mv.jumpHeld && s.jumping) g *= num(S, "fallGravityMultiplier") * 1.5;
    s.vel.y = Math.max(s.vel.y - g * dt, -num(S, "maxFallSpeed"));

    // ---- collide via Rapier character controller
    tmp.v.set(s.vel.x * dt, s.vel.y * dt, s.vel.z * dt);
    controller.computeColliderMovement(c, tmp.v);
    const m = controller.computedMovement();
    const p = b.translation();
    const next = { x: p.x + m.x, y: p.y + m.y, z: p.z + m.z };
    const groundedNow = controller.computedGrounded();
    if (dt > 0 && m.y > tmp.v.y + 1e-4 && s.vel.y < 0) s.vel.y = 0; // landed / blocked below
    if (dt > 0 && s.vel.y > 0 && m.y < tmp.v.y - 1e-4) s.vel.y = 0; // bonked ceiling
    if (groundedNow && s.vel.y <= 0) {
      s.vel.y = 0;
      s.jumping = false;
      s.lastGroundedAt = now;
    }
    s.grounded = groundedNow && s.vel.y <= 0;
    // Stop velocity into walls
    if (dt > 0) {
      const ax = m.x / dt, az = m.z / dt;
      if (Math.abs(ax) < Math.abs(s.vel.x) - 0.01) s.vel.x = ax;
      if (Math.abs(az) < Math.abs(s.vel.z) - 0.01) s.vel.z = az;
    }

    if (next.y < -25) {
      b.setTranslation(SPAWN, true);
      s.vel.set(0, 0, 0);
      s.camTarget.copy(SPAWN);
      s.lastPos.copy(SPAWN);
      trail.count = 0;
    } else b.setNextKinematicTranslation(next);

    // ---- facing
    const hs = Math.hypot(s.vel.x, s.vel.z);
    if (hasInput && hs > 0.1) {
      const want = Math.atan2(dx, dz);
      s.facing += angleDiff(s.facing, want) * (1 - Math.exp(-num(S, "turnSpeed") * dt));
    }
    if (visual.current) {
      visual.current.rotation.y = s.facing;
      const sq = s.grounded ? 1 : THREE.MathUtils.clamp(1 + s.vel.y * 0.006, 0.9, 1.1);
      visual.current.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    }

    // ---- blob shadow
    if (shadow.current) {
      const ray = new rapier.Ray({ x: next.x, y: next.y, z: next.z }, { x: 0, y: -1, z: 0 });
      const hit = world.castRay(ray, 60, true, undefined, undefined, c);
      if (hit) {
        const h = hit.timeOfImpact;
        shadow.current.visible = true;
        shadow.current.position.set(next.x, next.y - h + 0.03, next.z);
        const dist = Math.max(0, h - (HALF + RADIUS));
        const k = 1 / (1 + dist * 0.15);
        shadow.current.scale.setScalar(k);
        (shadow.current.material as THREE.MeshBasicMaterial).opacity = 0.45 * k;
      } else shadow.current.visible = false;
    }

    // ---- trail
    const airborne = !s.grounded;
    if (airborne) {
      if (!s.wasAirborne && !s.jumping) archiveTrail(); // walked off a ledge
      trail.acc += dt;
      if (trail.acc > 1 / 60 && trail.count < TRAIL_MAX) {
        trail.acc = 0;
        const arr = trail.attr.array as Float32Array;
        arr[trail.count * 3] = next.x;
        arr[trail.count * 3 + 1] = next.y - (HALF + RADIUS) + 0.05;
        arr[trail.count * 3 + 2] = next.z;
        trail.count++;
        trail.attr.needsUpdate = true;
      }
    }
    trail.geo.setDrawRange(0, trail.count);
    s.wasAirborne = airborne;

    // ---- camera
    const dist = num(S, "cameraDistance");

    // Leash camera (Jak and Daxter / Mario 64 style): the camera behaves as if
    // it's tied to the player by a rope of length `dist`. We take where the
    // camera sat last frame, see which direction it now lies from the player,
    // and re-place it at rope length along that direction. Running forward drags
    // it behind; turning or strafing pulls it around; running toward it just
    // pushes it straight back, so there's no spin.
    const leash = num(S, "leashSwing");
    if (leash > 0) {
      const camX = s.lastPos.x + Math.sin(s.camYaw) * dist;
      const camZ = s.lastPos.z + Math.cos(s.camYaw) * dist;
      const ox = camX - next.x, oz = camZ - next.z;
      if (Math.hypot(ox, oz) > 0.001) {
        s.camYaw += angleDiff(s.camYaw, Math.atan2(ox, oz)) * leash;
      }
    }
    s.lastPos.set(next.x, next.y, next.z);

    if (bool(S, "autoRotate") && hs > 0.5 && now - input.lastOrbitAt > 1) {
      // Only swing behind the player when they run AWAY from the camera.
      // Running toward the camera or sideways would otherwise make the camera
      // chase the player, which turns camera-relative input, which curves the
      // player — a feedback loop that spins in circles.
      const awayFromCam = (s.vel.x * fx + s.vel.z * fz) / hs; // 1 = straight away, 0 = sideways, -1 = toward
      if (awayFromCam > 0) {
        const want = Math.atan2(s.vel.x, s.vel.z) + Math.PI;
        const k = 1 - Math.exp(-num(S, "autoRotateSpeed") * (hs / maxSpeed) * awayFromCam * dt);
        s.camYaw += angleDiff(s.camYaw, want) * k;
      }
    }
    const smooth = num(S, "followSmoothing");
    const fk = smooth <= 0.001 ? 1 : 1 - Math.exp(-dt / smooth);
    s.camTarget.lerp(tmp.look.set(next.x, next.y, next.z), fk);
    const height = num(S, "cameraHeight") + s.camPitch * dist;
    camera.position.set(
      s.camTarget.x + Math.sin(s.camYaw) * dist,
      s.camTarget.y + height,
      s.camTarget.z + Math.cos(s.camYaw) * dist,
    );
    camera.lookAt(s.camTarget.x, s.camTarget.y + 0.8, s.camTarget.z);

    liveStats.speed = hs;
    liveStats.vy = s.vel.y;
    liveStats.grounded = s.grounded;
    liveStats.gravity = gravity;
    liveStats.jumpVelocity = jumpVelocity;
  };

  return (
    <>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={SPAWN.toArray()} enabledRotations={[false, false, false]}>
        <CapsuleCollider ref={collider} args={[HALF, RADIUS]} />
        <group ref={visual} position={[0, -(HALF + RADIUS), 0]}>
          <group position={[0, HALF + RADIUS, 0]}>
            <mesh castShadow>
              <capsuleGeometry args={[RADIUS, HALF * 2, 8, 16]} />
              <meshStandardMaterial color="#ff7a59" roughness={0.45} />
            </mesh>
            {/* eyes */}
            {[-0.17, 0.17].map((x) => (
              <group key={x} position={[x, 0.35, RADIUS - 0.06]}>
                <mesh>
                  <sphereGeometry args={[0.12, 16, 12]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.3} />
                </mesh>
                <mesh position={[0, 0, 0.08]}>
                  <sphereGeometry args={[0.06, 12, 10]} />
                  <meshStandardMaterial color="#1d2433" roughness={0.2} />
                </mesh>
              </group>
            ))}
            {/* nose */}
            <mesh position={[0, 0.12, RADIUS + 0.04]} rotation-x={Math.PI / 2} castShadow>
              <coneGeometry args={[0.09, 0.22, 12]} />
              <meshStandardMaterial color="#ffb547" roughness={0.5} />
            </mesh>
          </group>
        </group>
      </RigidBody>

      <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={2}>
        <circleGeometry args={[RADIUS * 1.1, 32]} />
        <meshBasicMaterial color="#1d2433" transparent opacity={0.45} depthWrite={false} polygonOffset polygonOffsetFactor={-4} />
      </mesh>

      <points geometry={ghost.geo} visible={showTrail && showGhost} frustumCulled={false}>
        <pointsMaterial color="#8a7fd6" size={0.12} sizeAttenuation transparent opacity={0.4} depthWrite={false} />
      </points>
      <points geometry={trail.geo} visible={showTrail} frustumCulled={false}>
        <pointsMaterial color="#2bb3a3" size={0.14} sizeAttenuation />
      </points>
    </>
  );
}
