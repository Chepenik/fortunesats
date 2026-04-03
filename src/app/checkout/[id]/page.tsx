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
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Checkout id={id} />
      </div>
    </main>
  );
}
