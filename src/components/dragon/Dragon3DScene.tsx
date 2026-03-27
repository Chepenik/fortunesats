"use client";

import { Suspense, useEffect, useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import { SerpentDragon } from "./SerpentDragon";

/* ─── Reduced-motion subscription (lint-safe, no setState in effect) ── */

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServer() {
  return false;
}

/* ─── Low-power detection (module-scope, safe because ssr: false) ── */

const IS_LOW_POWER = (() => {
  if (typeof window === "undefined") return false;
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const cores = navigator.hardwareConcurrency ?? 8;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
  return isTouch && (cores <= 4 || mem <= 4);
})();

/* ─── Component ──────────────────────────────────────────── */

export function Dragon3DScene() {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getReducedMotionServer,
  );

  // Suppress THREE.Clock deprecation warning from @react-three/fiber internals
  // (R3F v9.x still uses Clock; fixed in v10 which is not yet stable)
  useEffect(() => {
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes("Clock")) return;
      origWarn.apply(console, args);
    };
    return () => { console.warn = origWarn; };
  }, []);

  return (
    <Canvas
      camera={{
        position: [0, 6.5, 9.5],
        fov: 40,
        near: 0.1,
        far: 60,
      }}
      dpr={IS_LOW_POWER ? [1, 1] : [1, 1.5]}
      gl={{
        alpha: true,
        antialias: !IS_LOW_POWER,
        powerPreference: IS_LOW_POWER ? "default" : "high-performance",
        preserveDrawingBuffer: false,
      }}
      style={{ background: "transparent" }}
      resize={{ debounce: 100 }}
    >
      <Suspense fallback={null}>
        {/* Warm dim ambient — lets neon glow pop */}
        <ambientLight intensity={0.3} color="#1a0a00" />

        {/* Key light — warm gold from upper-right */}
        <directionalLight
          position={[8, 14, 6]}
          intensity={1.2}
          color="#ffd700"
        />

        {/* Fill light — deep orange from opposite side */}
        <directionalLight
          position={[-6, 5, -4]}
          intensity={0.4}
          color="#ff6600"
        />

        {/* Neon red rim from behind-right */}
        <directionalLight
          position={[5, 3, -8]}
          intensity={0.6}
          color="#ff2200"
        />

        {/* Deep ember glow from below */}
        <pointLight
          position={[0, -4, 0]}
          intensity={0.3}
          color="#cc3300"
          distance={14}
          decay={2}
        />

        {/* Amber accent from behind-left */}
        <pointLight
          position={[-5, 6, -5]}
          intensity={0.35}
          color="#ffaa00"
          distance={12}
          decay={2}
        />

        <SerpentDragon reducedMotion={reducedMotion} lowPower={IS_LOW_POWER} />
      </Suspense>
    </Canvas>
  );
}
