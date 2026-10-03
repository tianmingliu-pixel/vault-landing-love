"use client";

import { Show, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { Lock } from "lucide-react";
import { TIER_LABEL, type Tier } from "../lib/tiers";
import { clerkEnabled } from "../lib/clerk-enabled";

/** What a reader sees in place of a section they can't read yet. */
export default function UnlockCta({ need, title, teaser, accent }: { need: Tier; title: string; teaser: string; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-8">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-40 blur-[2px]" style={{ background: `repeating-linear-gradient(180deg, transparent 0 22px, ${accent}22 22px 24px)` }} />
      <div className="relative">
        <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest" style={{ color: accent }}>
          <Lock size={13} aria-hidden="true" /> {need === "member" ? "Members" : `${TIER_LABEL[need]} plan`} section
        </p>
        <h3 className="mt-2 text-xl font-semibold text-slate-100">{title}</h3>
        <p className="mt-2 max-w-xl text-slate-400">{teaser}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {need === "member" && !clerkEnabled ? (
            <span className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm text-slate-400">Sign-up opens once accounts are configured</span>
          ) : need === "member" ? (
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button type="button" className="rounded-lg px-5 py-2.5 font-semibold text-slate-950" style={{ background: accent }}>Sign in with Google to read</button>
              </SignInButton>
            </Show>
          ) : (
            <Link href="/pricing" className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-amber-400 px-5 py-2.5 font-semibold text-slate-950 hover:opacity-90">
              Unlock from $19.99/month
            </Link>
          )}
          <Link href="/pricing" className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:border-slate-500">Compare plans</Link>
        </div>
      </div>
    </div>
  );
}
