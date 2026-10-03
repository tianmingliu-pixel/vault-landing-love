import Stripe from "stripe";
import { clerkClient } from "@clerk/nextjs/server";
import type { PlanMetadata } from "./membership";
import { isPaidPlan } from "./plans";

/** Stripe: STRIPE_SECRET_KEY (sk_test_… while testing, sk_live_… to take real payments). Null when not configured. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
}

/**
 * Writes a subscription onto the Clerk user — the only place the site reads the plan from.
 * Events for a subscription that is no longer the user's current one (e.g. the old plan cancelled after an upgrade) are ignored.
 */
export async function syncSubscription(userId: string, subscription: Stripe.Subscription, { force = false } = {}) {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const current = (user.publicMetadata ?? {}) as PlanMetadata;
  if (!force && current.subscriptionId && current.subscriptionId !== subscription.id) return current;
  const active = subscription.status === "active" || subscription.status === "trialing";
  const plan = subscription.metadata?.plan;
  const meta: PlanMetadata = {
    plan: active && isPaidPlan(plan) ? plan : "free",
    stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
    subscriptionId: subscription.id,
    currentPeriodEnd: subscription.items.data[0]?.current_period_end,
  };
  await client.users.updateUserMetadata(userId, { publicMetadata: meta });
  return meta;
}
