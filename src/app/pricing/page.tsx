import type { Metadata } from "next";
import Link from "next/link";
import { Check, Download, Gem, Crown, Shield } from "lucide-react";
import SiteHeader from "../site-header";
import { getReader, TIER_RANK } from "../lib/membership";
import { getStripe } from "../lib/stripe";
import { PAID_ORDER, PLANS, price, type PaidPlan } from "../lib/plans";
import JoinButton from "./join-button";

export const metadata: Metadata = { title: "Plans | Tianming Liu", description: "Platinum, Diamond and Supreme plans for the articles, labs and kits." };

const ICON: Record<PaidPlan, typeof Gem> = { platinum: Shield, diamond: Gem, supreme: Crown };

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ need?: string; canceled?: string }> }) {
  const { need, canceled } = await searchParams;
  const reader = await getReader();
  const stripeReady = Boolean(getStripe());
  const live = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 pb-24">
        <div className="relative pb-14 pt-10 text-center sm:pt-16">
          <div aria-hidden="true" className="absolute left-1/2 top-0 h-56 w-[40rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-slate-300/10 via-cyan-400/20 to-fuchsia-500/25 blur-3xl" />
          <p className="relative font-mono text-xs uppercase tracking-widest text-cyan-300">Plans · 会员计划</p>
          <h1 className="relative mt-3 text-4xl font-bold sm:text-5xl">Choose how deep you go.</h1>
          <p className="relative mx-auto mt-4 max-w-2xl text-lg text-slate-400">Every article&apos;s overview is free. Sign in with Google for the walkthroughs; a plan unlocks the labs, the kits and the complete vault.</p>
          {need === "signin" && <p className="relative mt-4 text-sm text-amber-300">Sign in with Google first, then choose a plan.</p>}
          {need === "accounts" && <p className="relative mt-4 text-sm text-amber-300">Accounts aren&apos;t configured on this deployment yet (Clerk keys missing).</p>}
          {need === "stripe" && <p className="relative mt-4 text-sm text-amber-300">Payments aren&apos;t configured on this deployment yet (STRIPE_SECRET_KEY missing).</p>}
          {need === "checkout" && <p className="relative mt-4 text-sm text-amber-300">Stripe couldn&apos;t start checkout. The exact reason is in the server log.</p>}
          {canceled && <p className="relative mt-4 text-sm text-slate-400">Checkout canceled — nothing was charged.</p>}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {PAID_ORDER.map((id) => {
            const plan = PLANS[id];
            const Icon = ICON[id];
            const current = reader.tier === id;
            const top = id === "supreme";
            const action = TIER_RANK[reader.tier] < TIER_RANK[id] ? (reader.tier === "anonymous" || reader.tier === "member" ? `Choose ${plan.name}` : `Upgrade to ${plan.name}`) : `Switch to ${plan.name}`;
            return (
              <div
                key={id}
                className={`relative flex flex-col overflow-hidden rounded-3xl border p-8 ${top ? "lg:-my-4 lg:py-12" : ""}`}
                style={{ borderColor: `${plan.color}66`, background: `linear-gradient(180deg, ${plan.color}1f, #020617 55%)`, boxShadow: top ? `0 0 80px -20px ${plan.color}` : undefined }}
              >
                <div aria-hidden="true" className="absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl" style={{ background: plan.color, opacity: 0.18 }} />
                {top && <span className="absolute right-6 top-6 rounded-full bg-gradient-to-r from-fuchsia-500 to-amber-400 px-3 py-0.5 font-mono text-[10px] uppercase tracking-widest text-slate-950">Top tier</span>}
                <Icon size={28} style={{ color: plan.color }} aria-hidden="true" />
                <p className="mt-4 font-mono text-xs uppercase tracking-widest" style={{ color: plan.color }}>{plan.name} · {plan.zh}</p>
                <p className="mt-2 text-5xl font-bold tracking-tight">
                  {price(plan.cents)}
                  <span className="text-base font-normal text-slate-400"> / month</span>
                </p>
                <p className="mt-2 text-sm text-slate-400">{plan.tagline}</p>
                <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-300">
                  {plan.perks.map((perk) => (
                    <li key={perk} className="flex gap-2">
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: plan.color }} aria-hidden="true" />
                      {perk}
                    </li>
                  ))}
                </ul>
                <div className="relative mt-8 space-y-3">
                  {current ? (
                    <>
                      <p className="rounded-lg border border-slate-700 px-4 py-2 text-center text-sm text-slate-300">Your current plan</p>
                      {id === "supreme" && (
                        <a href="/api/kit-bundle" className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold text-slate-950" style={{ background: plan.color }}>
                          <Download size={15} aria-hidden="true" /> Download all kits
                        </a>
                      )}
                      <form action="/api/billing-portal" method="post">
                        <button className="w-full rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold hover:border-slate-400">Manage or cancel</button>
                      </form>
                    </>
                  ) : reader.tier === "anonymous" ? (
                    <JoinButton label={`Sign in with Google to choose ${plan.name}`} />
                  ) : (
                    <form action="/api/checkout" method="post">
                      <input type="hidden" name="plan" value={id} />
                      <button disabled={!stripeReady} className="w-full rounded-lg px-4 py-3 font-semibold text-slate-950 hover:opacity-90 disabled:opacity-40" style={{ background: plan.color }}>
                        {stripeReady ? action : "Payments not configured"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-emerald-400">Open · free</p>
            <p className="mt-2 text-slate-300">Every article&apos;s overview, its primary sources and videos, and the Live Earth &amp; Space dashboard. No account needed.</p>
            <Link href="/blog" className="mt-4 inline-block text-sm font-semibold text-emerald-300 hover:text-emerald-200">Start reading &rarr;</Link>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
            <p className="font-mono text-xs uppercase tracking-widest text-sky-400">Member · free with Google</p>
            <p className="mt-2 text-slate-300">Sign in with your Google account to unlock the hands-on walkthrough in every article.</p>
            <div className="mt-4 max-w-xs">{reader.tier === "anonymous" ? <JoinButton label="Sign in with Google" /> : <p className="text-sm text-slate-400">You&apos;re signed in.</p>}</div>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-3xl text-center text-xs leading-relaxed text-slate-500">
          Payments are handled by Stripe on its own secure checkout page — pay by card, or by US bank account where enabled. Card and bank details never pass through this site.
          Plans renew monthly; change or cancel any time from &ldquo;Manage or cancel&rdquo;.
          {!live && " This deployment is in Stripe test mode: use card 4242 4242 4242 4242, no money moves."}
        </p>
      </main>
    </div>
  );
}
