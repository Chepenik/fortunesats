"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  COLORS,
  ORBIT,
  BODY,
  FIRE,
  lerp,
  getBodyRadius,
  getCrossRadii,
  curvePosition,
  curveTangent,
} from "./dragon-data";

// ─── Pre-allocated temp objects (zero GC) ─────────────────

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _localUp = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _rotMat = new THREE.Matrix4();
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _worldUp = new THREE.Vector3(0, 1, 0);

// ─── Fire particle pool ──────────────────────────────────

interface FireParticle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  scale: number;
}

const FIRE_COLORS = [
  new THREE.Color("#ffffdd"),
  new THREE.Color("#ffcc44"),
  new THREE.Color("#ff6622"),
  new THREE.Color("#c41e3a"),
];

function createFirePool(): FireParticle[] {
  return Array.from({ length: FIRE.maxParticles }, () => ({
    active: false,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    life: 0,
    maxLife: 1,
    scale: 1,
  }));
}

// ─── Component ────────────────────────────────────────────

export function SerpentDragon({
  reducedMotion = false,
}: {
  reducedMotion?: boolean;
}) {
  // Refs
  const headGroupRef = useRef<THREE.Group>(null!);
  const maneRef = useRef<THREE.InstancedMesh>(null!);
  const leftArmRef = useRef<THREE.Group>(null!);
  const rightArmRef = useRef<THREE.Group>(null!);
  const leftLegRef = useRef<THREE.Group>(null!);
  const rightLegRef = useRef<THREE.Group>(null!);
  const fireRef = useRef<THREE.InstancedMesh>(null!);
  const headLightRef = useRef<THREE.PointLight>(null!);
  const eyeLightRef = useRef<THREE.PointLight>(null!);

  const phaseRef = useRef(0);
  const headPos = useRef(new THREE.Vector3());
  const headDir = useRef(new THREE.Vector3(1, 0, 0));

  // Pre-allocated per-segment frame data
  const S = BODY.tubeSegments;
  const R = BODY.radialSegments;
  const segPos = useRef(
    Array.from({ length: S + 1 }, () => new THREE.Vector3())
  );
  const segFwd = useRef(
    Array.from({ length: S + 1 }, () => new THREE.Vector3())
  );
  const segRgt = useRef(
    Array.from({ length: S + 1 }, () => new THREE.Vector3())
  );
  const segUp = useRef(
    Array.from({ length: S + 1 }, () => new THREE.Vector3())
  );

  // Mouse
  const mouse = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // ─── Body tube geometry ─────────────────────────────────

  const bodyGeo = useMemo(() => {
    const vCount = (S + 1) * (R + 1);
    const positions = new Float32Array(vCount * 3);
    const normals = new Float32Array(vCount * 3);
    const colors = new Float32Array(vCount * 3);

    const indices: number[] = [];
    for (let i = 0; i < S; i++) {
      for (let j = 0; j < R; j++) {
        const a = i * (R + 1) + j;
        const b = (i + 1) * (R + 1) + j;
        const c = (i + 1) * (R + 1) + (j + 1);
        const d = i * (R + 1) + (j + 1);
        indices.push(a, b, d, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [S, R]);

  // ─── Materials ──────────────────────────────────────────

  const bodyMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.28,
        metalness: 0.1,
        clearcoat: 0.25,
        clearcoatRoughness: 0.3,
      }),
    []
  );

  const eyeWhiteMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f0ece8",
        roughness: 0.2,
        metalness: 0.05,
        emissive: "#f0ece8",
        emissiveIntensity: 0.2,
      }),
    []
  );

  const pupilMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#d4a257",
        roughness: 0.15,
        metalness: 0.3,
        emissive: "#d4a257",
        emissiveIntensity: 0.5,
      }),
    []
  );

  const hornMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#d4a257",
        roughness: 0.2,
        metalness: 0.35,
      }),
    []
  );

  const maneMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#e8a838",
        roughness: 0.35,
        metalness: 0.1,
        side: THREE.DoubleSide,
        emissive: "#e8a838",
        emissiveIntensity: 0.08,
      }),
    []
  );

  const limbMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#c41e3a",
        roughness: 0.3,
        metalness: 0.15,
      }),
    []
  );

  const clawMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f0ece4",
        roughness: 0.3,
        metalness: 0.1,
      }),
    []
  );

  const fireMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        toneMapped: false,
      }),
    []
  );

  // ─── Detail geometries ─────────────────────────────────

  const eyeGeo = useMemo(() => new THREE.SphereGeometry(0.052, 10, 8), []);
  const pupilGeo = useMemo(() => new THREE.SphereGeometry(0.028, 8, 6), []);
  const hornGeo = useMemo(() => new THREE.ConeGeometry(0.032, 0.28, 8), []);
  const whiskerGeo = useMemo(
    () => new THREE.CylinderGeometry(0.007, 0.002, 0.22, 4),
    []
  );
  const upperLimbGeo = useMemo(
    () => new THREE.CylinderGeometry(0.032, 0.018, 0.11, 6),
    []
  );
  const lowerLimbGeo = useMemo(
    () => new THREE.CylinderGeometry(0.018, 0.012, 0.09, 5),
    []
  );
  const clawGeo = useMemo(() => new THREE.ConeGeometry(0.01, 0.045, 4), []);
  const fireGeo = useMemo(() => new THREE.IcosahedronGeometry(0.022, 0), []);

  // Mane fin — elongated triangle
  const maneGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const v = new Float32Array([
      -0.012, 0, 0, 0.012, 0, 0, 0, 0.1, 0,
    ]);
    const n = new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]);
    geo.setAttribute("position", new THREE.BufferAttribute(v, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(n, 3));
    return geo;
  }, []);

  // Mane randomization (computed once)
  const maneOffsets = useMemo(
    () =>
      Array.from({ length: BODY.maneCount + 10 }, () => ({
        heightScale: 0.7 + Math.random() * 0.6,
        lean: (Math.random() - 0.5) * 0.25,
      })),
    []
  );

  // Fire pool
  const firePool = useRef(createFirePool());
  const nextFireTime = useRef(Math.random() * 4 + 3);

  // ─── Init hidden instances ──────────────────────────────

  useEffect(() => {
    // Mane
    const mane = maneRef.current;
    if (mane) {
      for (let i = 0; i < BODY.maneCount + 10; i++) {
        _dummy.position.set(0, -200, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        mane.setMatrixAt(i, _dummy.matrix);
      }
      mane.instanceMatrix.needsUpdate = true;
    }
    // Fire
    const fire = fireRef.current;
    if (fire) {
      for (let i = 0; i < FIRE.maxParticles; i++) {
        _dummy.position.set(0, -200, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        fire.setMatrixAt(i, _dummy.matrix);
        fire.setColorAt(i, new THREE.Color("#ffcc44"));
      }
      fire.instanceMatrix.needsUpdate = true;
      if (fire.instanceColor) fire.instanceColor.needsUpdate = true;
    }
  }, []);

  // ─── Frame loop ─────────────────────────────────────────

  useFrame((_, delta) => {
    // Advance phase
    if (!reducedMotion) {
      const mouseInfl = mouse.current.x * 0.015;
      phaseRef.current += (ORBIT.speed + mouseInfl) * delta;
    } else {
      phaseRef.current += ORBIT.speed * 0.25 * delta;
    }
    const phase = phaseRef.current;

    // ─── Update body tube ────────────────────────────────

    const positions = bodyGeo.attributes.position.array as Float32Array;
    const normals = bodyGeo.attributes.normal.array as Float32Array;
    const colors = bodyGeo.attributes.color.array as Float32Array;

    for (let i = 0; i <= S; i++) {
      const f = i / S;
      const curveT = phase - i * BODY.spacing;
      const center = curvePosition(curveT);
      const tangent = curveTangent(curveT);

      // Secondary serpentine waves
      if (!reducedMotion) {
        _forward.copy(tangent);
        _right.crossVectors(_forward, _worldUp).normalize();
        _localUp.crossVectors(_right, _forward).normalize();
        const sideWave =
          Math.sin(phase * 1.6 - i * 0.14) * 0.07 * (1 - f * 0.3);
        const vertWave =
          Math.sin(phase * 2.2 - i * 0.11) * 0.04 * (1 - f * 0.5);
        center.addScaledVector(_right, sideWave);
        center.y += vertWave;
      }

      // Local frame
      _forward.copy(tangent).normalize();
      _right.crossVectors(_forward, _worldUp).normalize();
      _localUp.crossVectors(_right, _forward).normalize();

      // Store for extras
      segPos.current[i].copy(center);
      segFwd.current[i].copy(_forward);
      segRgt.current[i].copy(_right);
      segUp.current[i].copy(_localUp);

      // Track head
      if (i === 4) {
        headPos.current.copy(center);
        headDir.current.copy(_forward);
      }

      // Cross-section radii
      const { h, v } = getCrossRadii(f);
      const rH = h * BODY.scale;
      const rV = v * BODY.scale;

      // Gold band check
      const isGold = f > 0.30 && f < 0.55 && Math.floor(i / 3) % 6 === 0;

      for (let j = 0; j <= R; j++) {
        const angle = (j / R) * Math.PI * 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        // Position on elliptical cross-section
        const px =
          center.x + cosA * _right.x * rH + sinA * _localUp.x * rV;
        const py =
          center.y + cosA * _right.y * rH + sinA * _localUp.y * rV;
        const pz =
          center.z + cosA * _right.z * rH + sinA * _localUp.z * rV;

        const idx3 = (i * (R + 1) + j) * 3;
        positions[idx3] = px;
        positions[idx3 + 1] = py;
        positions[idx3 + 2] = pz;

        // Normal (outward)
        const nx = cosA * _right.x + sinA * _localUp.x;
        const ny = cosA * _right.y + sinA * _localUp.y;
        const nz = cosA * _right.z + sinA * _localUp.z;
        normals[idx3] = nx;
        normals[idx3 + 1] = ny;
        normals[idx3 + 2] = nz;

        // Color — smooth gradients
        let cr: number, cg: number, cb: number;
        if (sinA > 0.55) {
          const t = Math.min(1, (sinA - 0.55) / 0.45);
          cr = lerp(COLORS.body.r, COLORS.mane.r, t);
          cg = lerp(COLORS.body.g, COLORS.mane.g, t);
          cb = lerp(COLORS.body.b, COLORS.mane.b, t);
        } else if (sinA < -0.45) {
          const t = Math.min(1, (-sinA - 0.45) / 0.55);
          cr = lerp(COLORS.body.r, COLORS.belly.r, t);
          cg = lerp(COLORS.body.g, COLORS.belly.g, t);
          cb = lerp(COLORS.body.b, COLORS.belly.b, t);
        } else {
          cr = COLORS.body.r;
          cg = COLORS.body.g;
          cb = COLORS.body.b;
        }

        // Gold band
        if (isGold && Math.abs(sinA) < 0.45) {
          cr = COLORS.band.r;
          cg = COLORS.band.g;
          cb = COLORS.band.b;
        }

        // Subtle side shading
        const shade = 1 - Math.abs(cosA) * 0.07;
        colors[idx3] = cr * shade;
        colors[idx3 + 1] = cg * shade;
        colors[idx3 + 2] = cb * shade;
      }
    }

    bodyGeo.attributes.position.needsUpdate = true;
    bodyGeo.attributes.normal.needsUpdate = true;
    bodyGeo.attributes.color.needsUpdate = true;
    bodyGeo.computeBoundingSphere();

    // ─── Head group ──────────────────────────────────────

    if (headGroupRef.current) {
      const hs = 4; // head center segment
      headGroupRef.current.position.copy(segPos.current[hs]);
      _rotMat.makeBasis(
        segRgt.current[hs],
        segUp.current[hs],
        segFwd.current[hs].clone().negate()
      );
      headGroupRef.current.quaternion.setFromRotationMatrix(_rotMat);
    }

    // ─── Mane fins ───────────────────────────────────────

    const mane = maneRef.current;
    if (mane) {
      let mi = 0;
      const step = Math.max(1, Math.floor(S / BODY.maneCount));
      for (let i = 2; i < S - 2 && mi < BODY.maneCount; i += step, mi++) {
        const f = i / S;
        const p = segPos.current[i];
        const fwd = segFwd.current[i];
        const rgt = segRgt.current[i];
        const up = segUp.current[i];
        const { v: rv } = getCrossRadii(f);
        const rV = rv * BODY.scale;

        // Position at top of body
        _pos.copy(p).addScaledVector(up, rV * 0.95);

        // Height profile
        let hScale = 1.0;
        if (f < 0.2) hScale = 1.6;
        else if (f < 0.3) hScale = 1.2;
        else if (f < 0.6) hScale = 0.85;
        else hScale = lerp(0.7, 0.3, (f - 0.6) / 0.4);

        const offsets = maneOffsets[mi];
        hScale *= offsets.heightScale;

        _dummy.position.copy(_pos);
        _rotMat.makeBasis(fwd, up, rgt);
        _dummy.quaternion.setFromRotationMatrix(_rotMat);
        // Apply lean
        _dummy.rotateZ(offsets.lean);
        _dummy.scale.set(1, hScale, 1);
        _dummy.updateMatrix();
        mane.setMatrixAt(mi, _dummy.matrix);
      }

      // Tail tuft — extra fins fanning out
      const tipSeg = S - 3;
      const tipP = segPos.current[tipSeg];
      const tipFwd = segFwd.current[tipSeg];
      const tipRgt = segRgt.current[tipSeg];
      const tipUp = segUp.current[tipSeg];

      const tuftAngles = [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1, Math.PI];
      for (let ti = 0; ti < tuftAngles.length && mi < BODY.maneCount + 10; ti++, mi++) {
        const a = tuftAngles[ti];
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const dir = _pos
          .set(0, 0, 0)
          .addScaledVector(tipUp, cos)
          .addScaledVector(tipRgt, sin)
          .normalize();

        _dummy.position.copy(tipP).addScaledVector(dir, 0.03);
        _rotMat.makeBasis(tipFwd, dir, _pos.copy(tipRgt).applyAxisAngle(tipFwd, a));
        _dummy.quaternion.setFromRotationMatrix(_rotMat);
        _dummy.scale.set(1.2, 0.8, 1);
        _dummy.updateMatrix();
        mane.setMatrixAt(mi, _dummy.matrix);
      }

      // Hide unused
      for (; mi < BODY.maneCount + 10; mi++) {
        _dummy.position.set(0, -200, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        mane.setMatrixAt(mi, _dummy.matrix);
      }

      mane.instanceMatrix.needsUpdate = true;
    }

    // ─── Limbs ───────────────────────────────────────────

    const armSeg = Math.floor(S * 0.30);
    const legSeg = Math.floor(S * 0.56);

    function positionLimb(
      ref: React.RefObject<THREE.Group>,
      seg: number,
      side: number // -1 = left, +1 = right
    ) {
      if (!ref.current) return;
      const p = segPos.current[seg];
      const r = segRgt.current[seg];
      const u = segUp.current[seg];
      const fwd = segFwd.current[seg];
      const { h } = getCrossRadii(seg / S);
      const rH = h * BODY.scale;

      ref.current.position
        .copy(p)
        .addScaledVector(r, side * rH * 0.9)
        .addScaledVector(u, -rH * 0.3);

      _rotMat.makeBasis(r, u, fwd.clone().negate());
      ref.current.quaternion.setFromRotationMatrix(_rotMat);
      // Slight sway animation
      if (!reducedMotion) {
        const sway = Math.sin(phase * 1.2 + seg * 0.5) * 0.15;
        ref.current.rotateZ(side * sway);
      }
    }

    positionLimb(leftArmRef, armSeg, -1);
    positionLimb(rightArmRef, armSeg, 1);
    positionLimb(leftLegRef, legSeg, -1);
    positionLimb(rightLegRef, legSeg, 1);

    // ─── Lights ──────────────────────────────────────────

    if (headLightRef.current) headLightRef.current.position.copy(headPos.current);
    if (eyeLightRef.current) eyeLightRef.current.position.copy(headPos.current);

    // ─── Fire particles ──────────────────────────────────

    if (!reducedMotion) {
      nextFireTime.current -= delta;
      if (nextFireTime.current <= 0) {
        emitFire();
        nextFireTime.current =
          FIRE.intervalMin + Math.random() * (FIRE.intervalMax - FIRE.intervalMin);
      }
    }

    const fire = fireRef.current;
    if (fire) {
      const pool = firePool.current;
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (p.active) {
          p.life -= delta;
          if (p.life <= 0) {
            p.active = false;
            _dummy.position.set(0, -200, 0);
            _dummy.scale.setScalar(0);
          } else {
            p.pos.addScaledVector(p.vel, delta);
            p.vel.y += delta * 0.35;
            const lifeFrac = p.life / p.maxLife;
            _dummy.position.copy(p.pos);
            _dummy.scale.setScalar(lifeFrac * p.scale);
            const ci = Math.min(
              FIRE_COLORS.length - 1,
              Math.floor((1 - lifeFrac) * FIRE_COLORS.length)
            );
            _color.copy(FIRE_COLORS[ci]);
            fire.setColorAt(i, _color);
          }
        } else {
          _dummy.position.set(0, -200, 0);
          _dummy.scale.setScalar(0);
        }
        _dummy.updateMatrix();
        fire.setMatrixAt(i, _dummy.matrix);
      }
      fire.instanceMatrix.needsUpdate = true;
      if (fire.instanceColor) fire.instanceColor.needsUpdate = true;
    }
  });

  function emitFire() {
    const pool = firePool.current;
    const count =
      FIRE.burstMin + Math.floor(Math.random() * (FIRE.burstMax - FIRE.burstMin));
    let emitted = 0;
    for (let i = 0; i < pool.length && emitted < count; i++) {
      if (!pool[i].active) {
        const p = pool[i];
        p.active = true;
        p.pos.copy(headPos.current).addScaledVector(headDir.current, 0.12);
        p.pos.x += (Math.random() - 0.5) * 0.06;
        p.pos.y += (Math.random() - 0.5) * 0.06;
        p.pos.z += (Math.random() - 0.5) * 0.06;
        p.vel
          .copy(headDir.current)
          .multiplyScalar(1.2 + Math.random() * 0.8)
          .add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 0.3,
              (Math.random() - 0.3) * 0.3,
              (Math.random() - 0.5) * 0.3
            )
          );
        p.maxLife = 0.25 + Math.random() * 0.3;
        p.life = p.maxLife;
        p.scale = 0.35 + Math.random() * 0.4;
        emitted++;
      }
    }
  }

  // ─── Limb sub-component ─────────────────────────────────

  function LimbGroup({ innerRef }: { innerRef: React.RefObject<THREE.Group> }) {
    return (
      <group ref={innerRef}>
        <mesh geometry={upperLimbGeo} material={limbMat} position={[0, -0.05, 0]} />
        <mesh
          geometry={lowerLimbGeo}
          material={limbMat}
          position={[0, -0.13, 0]}
        />
        <mesh
          geometry={clawGeo}
          material={clawMat}
          position={[-0.012, -0.19, 0]}
          rotation={[0, 0, 0.2]}
        />
        <mesh
          geometry={clawGeo}
          material={clawMat}
          position={[0.012, -0.19, 0]}
          rotation={[0, 0, -0.2]}
        />
        <mesh
          geometry={clawGeo}
          material={clawMat}
          position={[0, -0.195, -0.008]}
        />
      </group>
    );
  }

  // ─── Render ─────────────────────────────────────────────

  return (
    <>
      {/* Smooth body tube */}
      <mesh geometry={bodyGeo} material={bodyMat} />

      {/* Head details */}
      <group ref={headGroupRef}>
        {/* Left eye: local X = body right, local -Z = forward */}
        <group position={[-0.38, 0.06, -0.08]}>
          <mesh geometry={eyeGeo} material={eyeWhiteMat} />
          <mesh
            geometry={pupilGeo}
            material={pupilMat}
            position={[-0.03, 0.005, -0.015]}
          />
        </group>
        {/* Right eye */}
        <group position={[0.38, 0.06, -0.08]}>
          <mesh geometry={eyeGeo} material={eyeWhiteMat} />
          <mesh
            geometry={pupilGeo}
            material={pupilMat}
            position={[0.03, 0.005, -0.015]}
          />
        </group>
        {/* Horns — sweep back and up */}
        <mesh
          geometry={hornGeo}
          material={hornMat}
          position={[-0.14, 0.35, 0.06]}
          rotation={[0.5, 0, -0.3]}
        />
        <mesh
          geometry={hornGeo}
          material={hornMat}
          position={[0.14, 0.35, 0.06]}
          rotation={[0.5, 0, 0.3]}
        />
        {/* Whiskers — 2 per side, sweeping forward and out */}
        <mesh
          geometry={whiskerGeo}
          material={hornMat}
          position={[-0.22, -0.02, -0.18]}
          rotation={[0.1, 0, -0.6]}
        />
        <mesh
          geometry={whiskerGeo}
          material={hornMat}
          position={[0.22, -0.02, -0.18]}
          rotation={[0.1, 0, 0.6]}
        />
        <mesh
          geometry={whiskerGeo}
          material={hornMat}
          position={[-0.18, -0.06, -0.22]}
          rotation={[-0.15, 0, -0.8]}
        />
        <mesh
          geometry={whiskerGeo}
          material={hornMat}
          position={[0.18, -0.06, -0.22]}
          rotation={[-0.15, 0, 0.8]}
        />
        {/* Brow ridges — small cylinders */}
        <mesh
          geometry={whiskerGeo}
          material={limbMat}
          position={[-0.28, 0.12, -0.06]}
          rotation={[0, 0, -1.2]}
          scale={[1.2, 0.35, 1.2]}
        />
        <mesh
          geometry={whiskerGeo}
          material={limbMat}
          position={[0.28, 0.12, -0.06]}
          rotation={[0, 0, 1.2]}
          scale={[1.2, 0.35, 1.2]}
        />
      </group>

      {/* Mane fins */}
      <instancedMesh
        ref={maneRef}
        args={[maneGeo, maneMat, BODY.maneCount + 10]}
        frustumCulled={false}
      />

      {/* Limbs */}
      <LimbGroup innerRef={leftArmRef} />
      <LimbGroup innerRef={rightArmRef} />
      <LimbGroup innerRef={leftLegRef} />
      <LimbGroup innerRef={rightLegRef} />

      {/* Fire particles */}
      <instancedMesh
        ref={fireRef}
        args={[fireGeo, fireMat, FIRE.maxParticles]}
        frustumCulled={false}
      />

      {/* Lighting */}
      <pointLight
        ref={headLightRef}
        intensity={0.5}
        color="#c41e3a"
        distance={4}
        decay={2}
      />
      <pointLight
        ref={eyeLightRef}
        intensity={0.25}
        color="#d4a257"
        distance={3}
        decay={2}
      />
    </>
  );
}
