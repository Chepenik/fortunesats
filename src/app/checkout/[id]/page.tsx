"use client";

import { use } from "react";
import { Checkout } from "@moneydevkit/nextjs";

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <main className="relative flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0 z-[1]">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full bg-lacquer/[0.04] blur-[120px]" />
        <div className="absolute bottom-[-10%] left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-gold/[0.03] blur-[100px]" />
      </div>

      <div className="relative z-[2] w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-gold/20" />
            <div className="h-1 w-1 rounded-full bg-lacquer/40" />
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-gold/20" />
          </div>
          <h1 className="text-lg font-semibold text-foreground/90 tracking-tight">
            Complete Payment
          </h1>
          <p className="text-xs text-gold/40 font-mono">
            100 sats for one fortune
          </p>
        </div>

        {/* MDK Checkout */}
        <div className="mdk-theme-override">
          <Checkout id={id} />
        </div>

        {/* Payment hint */}
        <div className="text-center space-y-3">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-gold/10 to-transparent" />
          <p className="text-xs text-gold/30 leading-relaxed">
            Please allow up to 15 seconds for your payment to be confirmed.
            <br />
            You will be redirected automatically.
          </p>
        </div>
      </div>
    </main>
  );
}
