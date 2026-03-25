"use client";

import dynamic from "next/dynamic";

const Dragon3DScene = dynamic(
  () =>
    import("./Dragon3DScene").then((m) => ({
      default: m.Dragon3DScene,
    })),
  { ssr: false }
);

export function DragonLoader() {
  return <Dragon3DScene />;
}
