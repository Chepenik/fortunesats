/**
 * Serpentine dragon — constants, curve math, and body profile.
 *
 * The dragon is a smooth tube following a 3D orbital curve,
 * with elliptical cross-sections that vary from head to tail.
 */

import * as THREE from "three";

// ─── Brand Palette ────────────────────────────────────────

export const COLORS = {
  body: new THREE.Color("#0d0d3b"),       // Deep midnight blue base
  bodyDark: new THREE.Color("#06061f"),    // Darker shade
  belly: new THREE.Color("#00ffcc"),       // Neon cyan-green belly
  mane: new THREE.Color("#ff00ff"),        // Hot magenta mane
  band: new THREE.Color("#00ffff"),        // Neon cyan diamond bands
  bandAlt: new THREE.Color("#ff00aa"),     // Neon pink alternate bands
  eyeWhite: new THREE.Color("#ccffff"),    // Icy white glow
  pupil: new THREE.Color("#39ff14"),       // Neon green pupils
  horn: new THREE.Color("#00ffff"),        // Cyan horns
  whisker: new THREE.Color("#bf00ff"),     // Electric purple whiskers
  claw: new THREE.Color("#ccffff"),        // Icy neon claws
  tailTuft: new THREE.Color("#ff00ff"),    // Magenta tail
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
  radialSegments: 16,
  scale: 0.24,
  spacing: 0.026,
  maneCount: 48,
} as const;

// ─── Fire ─────────────────────────────────────────────────

export const FIRE = {
  maxParticles: 64,
  intervalMin: 3,
  intervalMax: 6,
  burstMin: 12,
  burstMax: 20,
  streamLength: 0.4,
  coneAngle: 0.15,
  lifetimeMin: 0.4,
  lifetimeMax: 0.9,
} as const;

// ─── Utilities ────────────────────────────────────────────

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

// ─── Body Radius Profile ─────────────────────────────────

export function getBodyRadius(f: number): number {
  // Narrow snout tip
  if (f < 0.02) return lerp(0.3, 0.8, f / 0.02);
  // Snout builds up
  if (f < 0.05) return lerp(0.8, 1.8, (f - 0.02) / 0.03);
  // Cranium — widest part of head
  if (f < 0.10) return lerp(1.8, 3.0, (f - 0.05) / 0.05);
  // Dramatic neck taper — key dragon silhouette
  if (f < 0.18) return lerp(3.0, 0.9, (f - 0.10) / 0.08);
  // Chest / shoulders build up
  if (f < 0.28) return lerp(0.9, 2.5, (f - 0.18) / 0.10);
  // Main body — gradual taper
  if (f < 0.55) return lerp(2.5, 2.2, (f - 0.28) / 0.27);
  // Body → tail transition
  if (f < 0.75) return lerp(2.2, 0.9, (f - 0.55) / 0.20);
  // Tail narrows
  if (f < 0.88) return lerp(0.9, 0.3, (f - 0.75) / 0.13);
  // Tail whip
  return lerp(0.3, 0.05, (f - 0.88) / 0.12);
}

/** Elliptical cross-section radii (h=horizontal, v=vertical). */
export function getCrossRadii(f: number): { h: number; v: number } {
  const base = getBodyRadius(f);
  if (f < 0.05) return { h: base * 0.75, v: base * 1.3 };   // snout: tall, narrow
  if (f < 0.10) return { h: base * 1.15, v: base * 1.0 };   // cranium: wide, round
  if (f < 0.18) return { h: base * 0.95, v: base * 1.1 };   // neck: slightly tall
  if (f < 0.30) return { h: base * 1.1, v: base * 0.95 };   // chest: broad shoulders
  return { h: base * 0.92, v: base * 1.08 };                 // body/tail: sleek
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
