import type { ReactNode } from "react";

/** A sci-fi HUD frame: corner brackets, a faint grid and an optional label strip. */
export function Hud({ children, accent, label, className = "" }: { children: ReactNode; accent: string; label?: string; className?: string }) {
  const corner = "pointer-events-none absolute h-4 w-4 border-current";
  return (
    <div className={`relative rounded-lg border border-slate-800/80 bg-slate-950/70 ${className}`} style={{ color: accent }}>
      <span aria-hidden="true" className={`${corner} -left-px -top-px border-l-2 border-t-2`} />
      <span aria-hidden="true" className={`${corner} -right-px -top-px border-r-2 border-t-2`} />
      <span aria-hidden="true" className={`${corner} -bottom-px -left-px border-b-2 border-l-2`} />
      <span aria-hidden="true" className={`${corner} -bottom-px -right-px border-b-2 border-r-2`} />
      {label && <p className="absolute -top-2.5 left-5 bg-slate-950 px-2 font-mono text-[10px] uppercase tracking-[0.25em]">{label}</p>}
      <div className="text-slate-200">{children}</div>
    </div>
  );
}
