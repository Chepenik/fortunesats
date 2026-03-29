import { Check, Copy, Link2 } from "lucide-react";

export function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function GoldDot() {
  return <div className="h-0.5 w-0.5 rounded-full bg-gold/20" />;
}

export function OracleSpinner() {
  return (
    <div className="relative h-10 w-10">
      <div className="absolute inset-0 rounded-full border border-gold/10" />
      <div className="absolute inset-0 rounded-full border border-transparent border-t-lacquer/50 animate-spin" />
      <div className="absolute inset-2 rounded-full bg-lacquer/[0.06] animate-glow-pulse" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-1.5 w-1.5 rounded-full bg-gold/40 shadow-[0_0_8px_rgba(212,162,87,0.3)]" />
      </div>
    </div>
  );
}

export function CopyIcon({ copied }: { copied: boolean }) {
  return (
    <span className="relative h-3 w-3">
      <span
        className={`absolute inset-0 transition-all duration-200 ${copied ? "scale-0 opacity-0" : "scale-100 opacity-100"}`}
      >
        <Copy className="h-3 w-3" />
      </span>
      <span
        className={`absolute inset-0 transition-all duration-200 ${copied ? "scale-100 opacity-100" : "scale-0 opacity-0"}`}
      >
        <Check className="h-3 w-3 text-cyan" />
      </span>
    </span>
  );
}

export function LinkIcon({ copied }: { copied: boolean }) {
  return (
    <span className="relative h-3 w-3">
      <span
        className={`absolute inset-0 transition-all duration-200 ${copied ? "scale-0 opacity-0" : "scale-100 opacity-100"}`}
      >
        <Link2 className="h-3 w-3" />
      </span>
      <span
        className={`absolute inset-0 transition-all duration-200 ${copied ? "scale-100 opacity-100" : "scale-0 opacity-0"}`}
      >
        <Check className="h-3 w-3 text-cyan" />
      </span>
    </span>
  );
}
