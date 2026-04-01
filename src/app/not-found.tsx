"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { fadeUp, scaleFade, ease } from "@/components/shared/animations";

const MISFORTUNES = [
  "The block you seek has been orphaned.",
  "You have wandered beyond the Silk Road. This path leads nowhere.",
  "404 sats paid, 0 fortunes received. The oracle is confused.",
  "Even the dragon cannot find this page.",
  "Your private key to this page has expired.",
  "The Lightning Network routed your request to the void.",
  "Confucius say: wrong URL, no fortune for you.",
  "This page was last seen in the mempool.",
];

export default function NotFound() {
  const [fortuneIndex, setFortuneIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFortuneIndex((i) => (i + 1) % MISFORTUNES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-16 overflow-hidden">
      {/* Ambient radial glows */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-lacquer/[0.04] blur-[120px]" />
        <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-gold/[0.03] blur-[100px]" />
        <div className="absolute top-[20%] right-[-10%] w-[200px] h-[200px] rounded-full bg-cyan/[0.02] blur-[80px]" />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-sm space-y-8 text-center"
        {...fadeUp}
      >
        {/* Ornamental divider */}
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-gold/20" />
          <div className="h-1 w-1 rounded-full bg-lacquer/40" />
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-gold/20" />
        </div>

        {/* Fortune cookie */}
        <motion.div {...scaleFade} transition={{ ...scaleFade.transition, delay: 0.15 }}>
          <span
            className="text-6xl drop-shadow-[0_0_20px_rgba(212,162,87,0.15)]"
            role="img"
            aria-label="Fortune cookie"
          >
            🥠
          </span>
        </motion.div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight neon-text">
            Misfortune
          </h1>
          <p className="text-sm text-muted-foreground/60 font-mono tracking-wide">
            Error 404 — The oracle has no wisdom here
          </p>
        </div>

        {/* Rotating misfortune card */}
        <div className="lacquer-surface rounded-2xl p-6 ornamental-border min-h-[100px] flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={fortuneIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease }}
              className="text-gold/80 italic font-light text-sm leading-relaxed"
            >
              <span className="text-lacquer/60">&ldquo;</span>
              {MISFORTUNES[fortuneIndex]}
              <span className="text-lacquer/60">&rdquo;</span>
            </motion.p>
          </AnimatePresence>
        </div>

        <p className="text-muted-foreground/35 text-[11px] tracking-wide">
          wait for the next misfortune…
        </p>

        {/* Dragon line divider */}
        <div className="dragon-line w-16 mx-auto" />

        {/* CTA */}
        <Link
          href="/"
          className="btn-lacquer inline-flex items-center justify-center w-full h-12 rounded-xl text-sm font-semibold tracking-wide transition-all active:scale-[0.98]"
        >
          Return to the Oracle
        </Link>

        {/* Footer quip */}
        <p className="text-[11px] tracking-[0.15em] uppercase text-gold/25 font-mono">
          The void is not on the Lightning Network
        </p>
      </motion.div>
    </main>
  );
}
