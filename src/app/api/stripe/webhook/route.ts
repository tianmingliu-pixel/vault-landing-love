import type Stripe from "stripe";
import { clerkClient } from "@clerk/nextjs/server";
import type { PlanMetadata } from "../../../lib/membership";
import { getStripe, syncSubscription } from "../../../lib/stripe";

// Stripe → site: keeps each account's plan in step with its subscription (new plans, renewals, cancellations, failed payments).
// Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook` and put the printed whsec_… in STRIPE_WEBHOOK_SECRET.
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return new Response("stripe not configured", { status: 501 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return new Response("bad signature", { status: 400 });
  }
  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    const userId = subscription.metadata?.clerkUserId;
    if (userId) {
      const isNewActive = event.type === "customer.subscription.created" && (subscription.status === "active" || subscription.status === "trialing");
      if (isNewActive) {
        // A new plan (first purchase or a switch): it becomes the current one and the previous subscription is cancelled.
        const user = await (await clerkClient()).users.getUser(userId);
        const previous = (user.publicMetadata as PlanMetadata).subscriptionId;
        await syncSubscription(userId, subscription, { force: true });
        if (previous && previous !== subscription.id) await stripe.subscriptions.cancel(previous).catch(() => undefined);
      } else {
        await syncSubscription(userId, subscription);
      }
    }
  }
  return Response.json({ received: true });
}
