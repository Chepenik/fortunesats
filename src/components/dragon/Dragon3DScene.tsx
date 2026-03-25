"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { SerpentDragon } from "./SerpentDragon";

export function Dragon3DScene() {
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Suppress THREE.Clock deprecation warning from @react-three/fiber internals
  // (R3F v9.x still uses Clock; fixed in v10 which is not yet stable)
  useEffect(() => {
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      if (typeof args[0] === "string" && args[0].includes("Clock")) return;
      origWarn.apply(console, args);
    };
    return () => {
      console.warn = origWarn;
    };
  }, []);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  if (!mounted) return null;

  return (
    <Canvas
      camera={{
        position: [0, 6.5, 9.5],
        fov: 40,
        near: 0.1,
        far: 60,
      }}
      dpr={[1, 1.5]}
      gl={{
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
      }}
      style={{ background: "transparent" }}
      resize={{ debounce: 100 }}
    >
      <Suspense fallback={null}>
        {/* Warm ambient — raised for body readability */}
        <ambientLight intensity={0.65} color="#f0ece4" />

        {/* Key light — warm gold from upper-right */}
        <directionalLight
          position={[8, 14, 6]}
          intensity={1.4}
          color="#d4a257"
        />

        {/* Fill light — cooler from opposite side */}
        <directionalLight
          position={[-6, 5, -4]}
          intensity={0.4}
          color="#f0ece4"
        />

        {/* Warm rim from behind-right — defines body edge against dark bg */}
        <directionalLight
          position={[5, 3, -8]}
          intensity={0.6}
          color="#ff8844"
        />

        {/* Lacquer red ambient glow from below */}
        <pointLight
          position={[0, -4, 0]}
          intensity={0.2}
          color="#c41e3a"
          distance={14}
          decay={2}
        />

        {/* Cyan rim accent from behind-left */}
        <pointLight
          position={[-5, 6, -5]}
          intensity={0.25}
          color="#00c8d4"
          distance={12}
          decay={2}
        />

        <SerpentDragon reducedMotion={reducedMotion} />
      </Suspense>
    </Canvas>
  );
}
