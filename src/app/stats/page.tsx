import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import SiteHeader from "../site-header";
import { isAdmin } from "../lib/admin";
import type { PlanMetadata } from "../lib/membership";
import { PAID_ORDER, PLANS, isPaidPlan, price, type PaidPlan } from "../lib/plans";
import { getStripe } from "../lib/stripe";

export const metadata: Metadata = { title: "Site stats", robots: { index: false } };
export const dynamic = "force-dynamic";

// Owner-only dashboard: who has signed up, who pays for what, and monthly recurring revenue.
// Page views and visitors are counted by Vercel Web Analytics (and Google Analytics on Cloud Run when configured).
export default async function StatsPage() {
  if (!(await isAdmin())) notFound();

  const client = await clerkClient();
  const total = await client.users.getCount();
  const byPlan: Record<PaidPlan | "member", number> = { member: 0, platinum: 0, diamond: 0, supreme: 0 };
  const recent: { email: string; created: number; plan: string }[] = [];
  for (let offset = 0; offset < Math.min(total, 2000); offset += 500) {
    const page = await client.users.getUserList({ limit: 500, offset, orderBy: "-created_at" });
    for (const user of page.data) {
      const plan = (user.publicMetadata as PlanMetadata).plan;
      const key = isPaidPlan(plan) ? plan : "member";
      byPlan[key] += 1;
      if (recent.length < 10) recent.push({ email: user.primaryEmailAddress?.emailAddress ?? "—", created: user.createdAt, plan: isPaidPlan(plan) ? PLANS[plan].name : "Member" });
    }
  }

  const stripe = getStripe();
  let mrrCents = 0;
  const active: Record<PaidPlan, number> = { platinum: 0, diamond: 0, supreme: 0 };
  if (stripe) {
    for await (const sub of stripe.subscriptions.list({ status: "active", limit: 100 })) {
      const plan = sub.metadata?.plan;
      if (!isPaidPlan(plan)) continue;
      active[plan] += 1;
      mrrCents += sub.items.data.reduce((sum, item) => sum + (item.price.unit_amount ?? 0) * (item.quantity ?? 1), 0);
    }
  }

  const tiles = [
    { label: "Signed-up users (Google)", value: total.toLocaleString("en-US") },
    { label: "Paying subscribers", value: (active.platinum + active.diamond + active.supreme).toLocaleString("en-US") },
    { label: "Monthly recurring revenue", value: stripe ? price(mrrCents) : "Stripe not set" },
    { label: "Visitors & page views", value: "Vercel Analytics" },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 pb-24">
        <h1 className="pt-8 text-3xl font-bold">Site stats</h1>
        <p className="mt-2 text-slate-400">Visible only to the accounts in ADMIN_EMAILS.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <p className="text-xs text-slate-400">{t.label}</p>
              <p className="mt-2 text-2xl font-semibold">{t.value}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-xl font-semibold">Plans</h2>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-slate-400">
            <tr><th className="py-2 font-medium">Plan</th><th className="font-medium">Price</th><th className="font-medium">Active (Stripe)</th><th className="font-medium">Accounts (Clerk)</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            <tr><td className="py-2">Member (free)</td><td>—</td><td>—</td><td>{byPlan.member}</td></tr>
            {PAID_ORDER.map((id) => (
              <tr key={id}><td className="py-2" style={{ color: PLANS[id].color }}>{PLANS[id].name} · {PLANS[id].zh}</td><td>{price(PLANS[id].cents)}/mo</td><td>{active[id]}</td><td>{byPlan[id]}</td></tr>
            ))}
          </tbody>
        </table>

        <h2 className="mt-12 text-xl font-semibold">Newest sign-ups</h2>
        <ul className="mt-4 divide-y divide-slate-800 text-sm">
          {recent.map((r) => (
            <li key={r.email + r.created} className="flex justify-between py-2"><span>{r.email}</span><span className="text-slate-400">{r.plan} · {new Date(r.created).toISOString().slice(0, 10)}</span></li>
          ))}
        </ul>

        <p className="mt-12 text-sm text-slate-400">
          Visitors, page views, countries, referrers and devices: Vercel dashboard → this project → <span className="text-slate-200">Analytics</span> (Web Analytics) and <span className="text-slate-200">Speed Insights</span>.
          On Cloud Run, set NEXT_PUBLIC_GA_ID to a Google Analytics 4 measurement id and use the GA dashboard.
        </p>
      </main>
    </div>
  );
}
