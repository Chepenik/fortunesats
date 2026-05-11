export function LuckyPrimeRow({ numbers }: { numbers: number[] }) {
  if (numbers.length === 0) return null;

  return (
    <div className="rounded-xl border border-cyan/10 bg-cyan/[0.025] px-3 py-2 space-y-1.5">
      <p className="text-[10px] tracking-[0.18em] uppercase font-mono text-cyan/45">
        Lucky prime signal
      </p>
      <div className="flex flex-wrap gap-1.5">
        {numbers.map((n) => (
          <span
            key={n}
            className="px-2 py-1 rounded-md bg-background/45 border border-cyan/10 font-mono text-[11px] text-cyan/70"
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}
