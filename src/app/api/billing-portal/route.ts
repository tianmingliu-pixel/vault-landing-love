import { NextResponse } from "next/server";
import { getReader } from "../../lib/membership";
import { getStripe } from "../../lib/stripe";

// Stripe's hosted billing portal: change card, download invoices or cancel. Needs the portal saved once in the
// Stripe dashboard (Settings → Billing → Customer portal) in test mode.
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const reader = await getReader();
  const stripe = getStripe();
  if (!stripe || !reader.meta.stripeCustomerId) return NextResponse.redirect(`${origin}/pricing`, 303);
  const portal = await stripe.billingPortal.sessions.create({ customer: reader.meta.stripeCustomerId, return_url: `${origin}/pricing` });
  return NextResponse.redirect(portal.url, 303);
}
