import { currentUser } from "@clerk/nextjs/server";
import { clerkEnabled } from "./clerk-enabled";
import { isPaidPlan, type PaidPlan } from "./plans";

import { canRead, TIER_LABEL, TIER_RANK, type Tier } from "./tiers";

export { canRead, TIER_LABEL, TIER_RANK, type Tier };

/** The plan lives in the Clerk user's public metadata, written only by the server after Stripe confirms payment. */
export type PlanMetadata = { plan?: PaidPlan | "free"; stripeCustomerId?: string; subscriptionId?: string; currentPeriodEnd?: number };

export async function getReader(): Promise<{ tier: Tier; userId: string | null; email: string | null; meta: PlanMetadata }> {
  const guest = { tier: "anonymous" as Tier, userId: null, email: null, meta: {} };
  if (!clerkEnabled) return guest;
  try {
    const user = await currentUser();
    if (!user) return guest;
    const meta = (user.publicMetadata ?? {}) as PlanMetadata;
    const active = isPaidPlan(meta.plan) && (!meta.currentPeriodEnd || meta.currentPeriodEnd * 1000 > Date.now());
    return { tier: active ? (meta.plan as PaidPlan) : "member", userId: user.id, email: user.primaryEmailAddress?.emailAddress ?? null, meta };
  } catch {
    return guest;
  }
}

