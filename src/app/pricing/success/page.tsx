import Link from "next/link";
import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { getReader } from "../../lib/membership";
import { PLANS, isPaidPlan } from "../../lib/plans";
import { getStripe, syncSubscription } from "../../lib/stripe";

// Back from Stripe Checkout: confirm the session belongs to this reader, switch the account to the new plan straight away,
// and cancel the previous subscription if this was an upgrade or downgrade (so nobody pays twice).
export default async function SuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  const reader = await getReader();
  const stripe = getStripe();
  if (!session_id || !stripe || !reader.userId) redirect("/pricing");
  const session = await stripe.checkout.sessions.retrieve(session_id, { expand: ["subscription"] });
  const subscription = session.subscription && typeof session.subscription !== "string" ? (session.subscription as Stripe.Subscription) : null;
  const ok = session.client_reference_id === reader.userId && session.status === "complete" && subscription !== null;
  let planName = "";
  if (ok && subscription) {
    const previous = reader.meta.subscriptionId;
    const meta = await syncSubscription(reader.userId, subscription, { force: true });
    if (previous && previous !== subscription.id) await stripe.subscriptions.cancel(previous).catch(() => undefined);
    if (isPaidPlan(meta.plan)) planName = `${PLANS[meta.plan].name} (${PLANS[meta.plan].zh})`;
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <div className="max-w-lg rounded-2xl border border-emerald-500/40 bg-slate-900/60 p-10 text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-emerald-400">{ok ? `Welcome to ${planName}` : "Payment not confirmed"}</p>
        <h1 className="mt-3 text-3xl font-bold">{ok ? "Your plan is active." : "We couldn't confirm that checkout."}</h1>
        <p className="mt-3 text-slate-400">{ok ? "Everything in your plan is unlocked across the articles. A receipt is on its way from Stripe." : "If you completed payment, give it a minute and refresh."}</p>
        <Link href="/blog" className="mt-8 inline-block rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 hover:bg-emerald-400">Go to the articles &rarr;</Link>
      </div>
    </div>
  );
}
