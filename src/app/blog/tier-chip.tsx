import type { Tier } from "../lib/tiers";

const STYLE: Record<Tier, string> = {
  anonymous: "border-emerald-400/50 text-emerald-300",
  member: "border-sky-400/50 text-sky-300",
  platinum: "border-slate-200/60 text-slate-100 bg-slate-200/10",
  diamond: "border-cyan-300/60 text-cyan-200 bg-cyan-400/10",
  supreme: "border-fuchsia-400/60 text-fuchsia-200 bg-fuchsia-500/10",
};
const LABEL: Record<Tier, string> = { anonymous: "Open", member: "Members", platinum: "Platinum", diamond: "Diamond", supreme: "Supreme" };

export default function TierChip({ tier }: { tier: Tier }) {
  return <span className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${STYLE[tier]}`}>{LABEL[tier]}</span>;
}
