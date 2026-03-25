/**
 * Serpentine dragon — constants, curve math, and body profile.
 *
 * The dragon is a smooth tube following a 3D orbital curve,
 * with elliptical cross-sections that vary from head to tail.
 */

import * as THREE from "three";

// ─── Brand Palette ────────────────────────────────────────

export const COLORS = {
  body: new THREE.Color("#c41e3a"),
  bodyDark: new THREE.Color("#7a1225"),
  belly: new THREE.Color("#d4a257"),
  mane: new THREE.Color("#e8a838"),
  band: new THREE.Color("#d4a257"),
  eyeWhite: new THREE.Color("#f0ece8"),
  pupil: new THREE.Color("#d4a257"),
  horn: new THREE.Color("#d4a257"),
  whisker: new THREE.Color("#d4a257"),
  claw: new THREE.Color("#f0ece4"),
  tailTuft: new THREE.Color("#c41e3a"),
} as const;

// ─── Orbit ────────────────────────────────────────────────

export const ORBIT = {
  radiusX: 3.8,
  radiusZ: 3.2,
  speed: 0.25,
  yAmplitude: 0.5,
  yFreq: 2,
} as const;

// ─── Body Tube ────────────────────────────────────────────

export const BODY = {
  tubeSegments: 100,
  radialSegments: 14,
  scale: 0.19,
  spacing: 0.026,
  maneCount: 38,
} as const;

// ─── Fire ─────────────────────────────────────────────────

export const FIRE = {
  maxParticles: 16,
  intervalMin: 7,
  intervalMax: 12,
  burstMin: 4,
  burstMax: 7,
} as const;

// ─── Utilities ────────────────────────────────────────────

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

// ─── Body Radius Profile ─────────────────────────────────

export function getBodyRadius(f: number): number {
  if (f < 0.03) return lerp(0.5, 1.2, f / 0.03);
  if (f < 0.07) return lerp(1.2, 2.5, (f - 0.03) / 0.04);
  if (f < 0.15) return lerp(2.5, 2.6, (f - 0.07) / 0.08);
  if (f < 0.22) return lerp(2.6, 1.2, (f - 0.15) / 0.07);
  if (f < 0.30) return lerp(1.2, 2.1, (f - 0.22) / 0.08);
  if (f < 0.56) return lerp(2.1, 2.0, (f - 0.30) / 0.26);
  if (f < 0.75) return lerp(2.0, 1.0, (f - 0.56) / 0.19);
  if (f < 0.88) return lerp(1.0, 0.4, (f - 0.75) / 0.13);
  return lerp(0.4, 0.08, (f - 0.88) / 0.12);
}

/** Elliptical cross-section radii (h=horizontal, v=vertical). */
export function getCrossRadii(f: number): { h: number; v: number } {
  const base = getBodyRadius(f);
  if (f < 0.15) return { h: base * 1.35, v: base * 0.75 }; // head: wide, flat
  if (f < 0.22) return { h: base * 1.05, v: base * 0.95 }; // neck: slightly oval
  return { h: base * 0.92, v: base * 1.08 }; // body/tail: slightly tall
}

// ─── Curve Evaluation ─────────────────────────────────────

export function curvePosition(t: number): THREE.Vector3 {
  return new THREE.Vector3(
    Math.cos(t) * ORBIT.radiusX,
    Math.sin(t * ORBIT.yFreq) * ORBIT.yAmplitude + Math.sin(t * 3) * 0.12,
    Math.sin(t) * ORBIT.radiusZ
  );
}

export function curveTangent(t: number): THREE.Vector3 {
  const dt = 0.0005;
  const a = curvePosition(t - dt);
  const b = curvePosition(t + dt);
  return b.sub(a).normalize();
}
