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
const _fireVelTemp = new THREE.Vector3();
const _lerpColor = new THREE.Color();

// ─── Fire particle pool ──────────────────────────────────

interface FireParticle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  scale: number;
  seed: number;
}

const FIRE_COLORS = [
  new THREE.Color("#ffffdd"),
  new THREE.Color("#ffcc44"),
  new THREE.Color("#ff6622"),
  new THREE.Color("#c41e3a"),
];

function createFirePool(): FireParticle[] {
  return Array.from({ length: FIRE.maxParticles }, (_, i) => ({
    active: false,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    life: 0,
    maxLife: 1,
    scale: 1,
    seed: i * 1.618,
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
  const snoutPos = useRef(new THREE.Vector3());
  const snoutDir = useRef(new THREE.Vector3(1, 0, 0));
  const fireIntensityRef = useRef(0.8);

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
    const uvs = new Float32Array(vCount * 2);

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
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    return geo;
  }, [S, R]);

  // ─── Materials ──────────────────────────────────────────

  const bodyMat = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.22,
      metalness: 0.1,
      clearcoat: 0.5,
      clearcoatRoughness: 0.15,
      sheen: 0.3,
      sheenRoughness: 0.4,
      sheenColor: new THREE.Color("#ff4466"),
      iridescence: 0.15,
      iridescenceIOR: 1.3,
      emissive: new THREE.Color("#c41e3a"),
      emissiveIntensity: 0.06,
    });

    mat.onBeforeCompile = (shader) => {
      // Inject UV varying into vertex shader (needed because we have no map)
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        /* glsl */ `
        #include <common>
        varying vec2 vScaleUv;
        `
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <uv_vertex>",
        /* glsl */ `
        #include <uv_vertex>
        vScaleUv = uv;
        `
      );

      // Inject varying + shared variables in fragment shader
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        /* glsl */ `
        #include <common>
        varying vec2 vScaleUv;
        float dragonBump = 0.0;
        vec2 dragonCell = vec2(0.0);
        `
      );

      // Scale bump pattern
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        /* glsl */ `
        #include <normal_fragment_maps>

        // ─── Procedural scale pattern ───
        {
          vec2 scaleUV = vScaleUv * vec2(28.0, 200.0);
          dragonCell = floor(scaleUV);
          vec2 local = fract(scaleUV);
          // Offset every other row for hex-like pattern
          if (mod(dragonCell.y, 2.0) > 0.5) local.x = fract(local.x + 0.5);
          // Diamond distance for scale edge ridges
          float d = abs(local.x - 0.5) + abs(local.y - 0.5);
          dragonBump = smoothstep(0.35, 0.5, d) * 0.4;
          // Perturb normal at scale edges
          float dBdx = dFdx(dragonBump);
          float dBdy = dFdy(dragonBump);
          normal = normalize(normal + vec3(dBdx, dBdy, 0.0) * 2.5);
        }
        `
      );

      // Belly glow + view-dependent shimmer
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        /* glsl */ `
        #include <emissivemap_fragment>

        // Belly glow — where vertex color leans gold/warm
        float bellyness = max(0.0, vColor.r * 0.5 + vColor.g * 0.8 - vColor.b * 1.5 - 0.4);
        totalEmissiveRadiance += vec3(0.8, 0.55, 0.2) * bellyness * 0.12;

        // View-dependent shimmer on scales
        float viewDot = abs(dot(normalize(vViewPosition), normal));
        float shimmerStrength = (1.0 - viewDot) * dragonBump * 0.15;
        totalEmissiveRadiance += vec3(
          sin(dragonCell.x * 1.3 + viewDot * 6.0) * 0.5 + 0.5,
          sin(dragonCell.y * 1.7 + viewDot * 6.0 + 2.0) * 0.5 + 0.5,
          sin(dragonCell.x * 0.9 + viewDot * 6.0 + 4.0) * 0.5 + 0.5
        ) * shimmerStrength;
        `
      );
    };

    mat.customProgramCacheKey = () => "dragon-scales-v1";
    return mat;
  }, []);

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

  const headMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#b01830",
        roughness: 0.25,
        metalness: 0.15,
        emissive: "#b01830",
        emissiveIntensity: 0.08,
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
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    []
  );

  // ─── Detail geometries ─────────────────────────────────

  const eyeGeo = useMemo(() => new THREE.SphereGeometry(0.055, 10, 8), []);
  const pupilGeo = useMemo(() => new THREE.SphereGeometry(0.03, 8, 6), []);
  const hornGeo = useMemo(() => new THREE.ConeGeometry(0.045, 0.5, 8), []);
  const whiskerGeo = useMemo(
    () => new THREE.CylinderGeometry(0.008, 0.002, 0.28, 4),
    []
  );
  const upperLimbGeo = useMemo(
    () => new THREE.CylinderGeometry(0.04, 0.022, 0.14, 6),
    []
  );
  const lowerLimbGeo = useMemo(
    () => new THREE.CylinderGeometry(0.022, 0.015, 0.12, 5),
    []
  );
  const clawGeo = useMemo(() => new THREE.ConeGeometry(0.013, 0.055, 4), []);
  const fireGeo = useMemo(() => new THREE.IcosahedronGeometry(0.03, 1), []);

  // Dragon head anatomy
  const snoutGeo = useMemo(
    () => new THREE.ConeGeometry(0.1, 0.35, 6),
    []
  );
  const jawGeo = useMemo(
    () => new THREE.ConeGeometry(0.07, 0.30, 5),
    []
  );
  const crownSpikeGeo = useMemo(
    () => new THREE.ConeGeometry(0.02, 0.15, 5),
    []
  );

  // Mane fin — larger dorsal spine triangle
  const maneGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const v = new Float32Array([
      -0.018, 0, 0, 0.018, 0, 0, 0, 0.2, 0.01,
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
    const uvs = bodyGeo.attributes.uv.array as Float32Array;

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

      // Track snout tip for fire emission
      if (i === 2) {
        snoutPos.current.copy(center);
        snoutDir.current.copy(_forward);
      }
      // Track cranium for head group placement
      if (i === 7) {
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

        // UVs for scale pattern
        const idx2 = (i * (R + 1) + j) * 2;
        uvs[idx2] = j / R;
        uvs[idx2 + 1] = f;
      }
    }

    bodyGeo.attributes.position.needsUpdate = true;
    bodyGeo.attributes.normal.needsUpdate = true;
    bodyGeo.attributes.color.needsUpdate = true;
    bodyGeo.attributes.uv.needsUpdate = true;
    bodyGeo.computeBoundingSphere();

    // ─── Head group ──────────────────────────────────────

    if (headGroupRef.current) {
      const hs = 7; // cranium center segment
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
      for (let i = 5; i < S - 2 && mi < BODY.maneCount; i += step, mi++) {
        const f = i / S;
        const p = segPos.current[i];
        const fwd = segFwd.current[i];
        const rgt = segRgt.current[i];
        const up = segUp.current[i];
        const { v: rv } = getCrossRadii(f);
        const rV = rv * BODY.scale;

        // Position at top of body
        _pos.copy(p).addScaledVector(up, rV * 0.95);

        // Height profile — dragon spine rhythm
        let hScale = 1.0;
        if (f < 0.10) hScale = 2.0;       // Head crest — tallest
        else if (f < 0.18) hScale = 1.8;  // Neck — still prominent
        else if (f < 0.30) hScale = 1.2;  // Shoulders
        else if (f < 0.55) hScale = 0.8;  // Body
        else hScale = lerp(0.6, 0.2, (f - 0.55) / 0.45);

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

    const armSeg = Math.floor(S * 0.24);
    const legSeg = Math.floor(S * 0.50);

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

    if (headLightRef.current) headLightRef.current.position.copy(snoutPos.current);
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

    // Decay fire light intensity
    fireIntensityRef.current += (0.8 - fireIntensityRef.current) * (1 - Math.exp(-5 * delta));
    if (headLightRef.current) {
      headLightRef.current.intensity = fireIntensityRef.current;
      const t = Math.min(1, (fireIntensityRef.current - 0.8) / 1.7);
      headLightRef.current.color.setRGB(
        lerp(0.77, 1.0, t),
        lerp(0.12, 0.4, t),
        lerp(0.23, 0.13, t)
      );
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
            const ageFrac = 1 - lifeFrac;

            // Turbulence
            const turb = Math.sin(p.seed + phase * 4) * 0.03 * lifeFrac;
            _dummy.position.copy(p.pos);
            _dummy.position.x += turb;
            _dummy.position.z += Math.cos(p.seed + phase * 3.5) * 0.02 * lifeFrac;

            // Bell-curve scale: grow fast in first 20%, then shrink
            const growPhase = Math.min(1, ageFrac / 0.2);
            const shrinkPhase = lifeFrac;
            _dummy.scale.setScalar(growPhase * shrinkPhase * p.scale * 2);

            // Smooth color lerp between FIRE_COLORS
            const colorPos = ageFrac * (FIRE_COLORS.length - 1);
            const ci = Math.min(FIRE_COLORS.length - 2, Math.floor(colorPos));
            const ct = colorPos - ci;
            _color.copy(FIRE_COLORS[ci]);
            _lerpColor.copy(FIRE_COLORS[ci + 1]);
            _color.lerp(_lerpColor, ct);
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

        // Distribute spawn along stream length (closer to mouth = more dense)
        const streamT = Math.random() * Math.random() * FIRE.streamLength;
        p.pos.copy(snoutPos.current).addScaledVector(snoutDir.current, 0.08 + streamT);

        // Cone spread widens with distance from mouth
        const spread = streamT * FIRE.coneAngle * 4;
        p.pos.x += (Math.random() - 0.5) * spread;
        p.pos.y += (Math.random() - 0.5) * spread;
        p.pos.z += (Math.random() - 0.5) * spread;

        // Velocity: fast along head direction with lateral spread
        _fireVelTemp.set(
          (Math.random() - 0.5) * 0.4,
          (Math.random() - 0.3) * 0.3,
          (Math.random() - 0.5) * 0.4
        );
        p.vel
          .copy(snoutDir.current)
          .multiplyScalar(1.5 + Math.random() * 1.0)
          .add(_fireVelTemp);

        p.maxLife = FIRE.lifetimeMin + Math.random() * (FIRE.lifetimeMax - FIRE.lifetimeMin);
        p.life = p.maxLife;
        p.scale = 0.5 + Math.random() * 0.7;
        emitted++;
      }
    }

    // Spike fire light intensity
    fireIntensityRef.current = 2.5;
  }

  // ─── Limb sub-component ─────────────────────────────────

  function LimbGroup({ innerRef }: { innerRef: React.RefObject<THREE.Group> }) {
    return (
      <group ref={innerRef}>
        <mesh geometry={upperLimbGeo} material={limbMat} position={[0, -0.06, 0]} />
        <mesh geometry={lowerLimbGeo} material={limbMat} position={[0, -0.16, 0]} />
        <mesh geometry={clawGeo} material={clawMat} position={[-0.015, -0.24, 0]} rotation={[0, 0, 0.2]} />
        <mesh geometry={clawGeo} material={clawMat} position={[0.015, -0.24, 0]} rotation={[0, 0, -0.2]} />
        <mesh geometry={clawGeo} material={clawMat} position={[0, -0.245, -0.01]} />
      </group>
    );
  }

  // ─── Render ─────────────────────────────────────────────

  return (
    <>
      {/* Smooth body tube */}
      <mesh geometry={bodyGeo} material={bodyMat} />

      {/* Head details — dragon anatomy */}
      <group ref={headGroupRef}>
        {/* Upper snout — tapered forward, angular */}
        <mesh
          geometry={snoutGeo}
          material={headMat}
          position={[0, 0.04, -0.22]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[1, 1, 0.65]}
        />

        {/* Lower jaw — angled open */}
        <mesh
          geometry={jawGeo}
          material={headMat}
          position={[0, -0.1, -0.18]}
          rotation={[-Math.PI / 2 + 0.18, 0, 0]}
          scale={[0.85, 1, 0.45]}
        />

        {/* Nose bridge ridge */}
        <mesh
          geometry={crownSpikeGeo}
          material={hornMat}
          position={[0, 0.14, -0.2]}
          rotation={[-0.3, 0, 0]}
          scale={[0.6, 0.5, 0.6]}
        />

        {/* Eyes — set into cranium, predatory */}
        <group position={[-0.35, 0.1, -0.12]}>
          <mesh geometry={eyeGeo} material={eyeWhiteMat} />
          <mesh geometry={pupilGeo} material={pupilMat} position={[-0.025, 0.005, -0.02]} />
        </group>
        <group position={[0.35, 0.1, -0.12]}>
          <mesh geometry={eyeGeo} material={eyeWhiteMat} />
          <mesh geometry={pupilGeo} material={pupilMat} position={[0.025, 0.005, -0.02]} />
        </group>

        {/* Horns — large, sweeping back dramatically */}
        <mesh
          geometry={hornGeo}
          material={hornMat}
          position={[-0.2, 0.4, 0.06]}
          rotation={[0.7, 0, -0.35]}
        />
        <mesh
          geometry={hornGeo}
          material={hornMat}
          position={[0.2, 0.4, 0.06]}
          rotation={[0.7, 0, 0.35]}
        />

        {/* Crown spikes — between and behind horns */}
        <mesh geometry={crownSpikeGeo} material={hornMat} position={[0, 0.34, 0.02]} />
        <mesh
          geometry={crownSpikeGeo}
          material={hornMat}
          position={[-0.09, 0.32, 0.08]}
          rotation={[0.3, 0, -0.2]}
          scale={[0.8, 0.8, 0.8]}
        />
        <mesh
          geometry={crownSpikeGeo}
          material={hornMat}
          position={[0.09, 0.32, 0.08]}
          rotation={[0.3, 0, 0.2]}
          scale={[0.8, 0.8, 0.8]}
        />

        {/* Brow ridges — thick, angular, menacing */}
        <mesh
          geometry={whiskerGeo}
          material={limbMat}
          position={[-0.3, 0.16, -0.08]}
          rotation={[0, 0, -1.0]}
          scale={[1.8, 0.5, 1.8]}
        />
        <mesh
          geometry={whiskerGeo}
          material={limbMat}
          position={[0.3, 0.16, -0.08]}
          rotation={[0, 0, 1.0]}
          scale={[1.8, 0.5, 1.8]}
        />

        {/* Cheekbone ridges */}
        <mesh
          geometry={whiskerGeo}
          material={limbMat}
          position={[-0.33, 0, -0.05]}
          rotation={[0.3, 0, -0.6]}
          scale={[1.5, 0.4, 1.5]}
        />
        <mesh
          geometry={whiskerGeo}
          material={limbMat}
          position={[0.33, 0, -0.05]}
          rotation={[0.3, 0, 0.6]}
          scale={[1.5, 0.4, 1.5]}
        />

        {/* Whiskers — long, sweeping, eastern dragon language */}
        <mesh
          geometry={whiskerGeo}
          material={hornMat}
          position={[-0.2, -0.04, -0.25]}
          rotation={[0.1, 0, -0.5]}
          scale={[1, 1.5, 1]}
        />
        <mesh
          geometry={whiskerGeo}
          material={hornMat}
          position={[0.2, -0.04, -0.25]}
          rotation={[0.1, 0, 0.5]}
          scale={[1, 1.5, 1]}
        />
        <mesh
          geometry={whiskerGeo}
          material={hornMat}
          position={[-0.16, -0.08, -0.28]}
          rotation={[-0.1, 0, -0.7]}
          scale={[1, 1.3, 1]}
        />
        <mesh
          geometry={whiskerGeo}
          material={hornMat}
          position={[0.16, -0.08, -0.28]}
          rotation={[-0.1, 0, 0.7]}
          scale={[1, 1.3, 1]}
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

      {/* Lighting — follows dragon head */}
      <pointLight
        ref={headLightRef}
        intensity={0.8}
        color="#c41e3a"
        distance={6}
        decay={2}
      />
      <pointLight
        ref={eyeLightRef}
        intensity={0.4}
        color="#d4a257"
        distance={4}
        decay={2}
      />
    </>
  );
}
