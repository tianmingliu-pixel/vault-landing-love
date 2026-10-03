import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getStripe } from "../../lib/stripe";
import { clerkEnabled } from "../../lib/clerk-enabled";
import { isPaidPlan, PLANS } from "../../lib/plans";

// Starts Stripe Checkout for one of the paid plans. Stripe hosts the payment page (cards, and US bank accounts when
// enabled in the dashboard) — card and bank details never touch this site — and pays out to the owner's bank account.
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const plan = (await request.formData()).get("plan");
  if (!isPaidPlan(plan)) return NextResponse.redirect(`${origin}/pricing`, 303);
  if (!clerkEnabled) return NextResponse.redirect(`${origin}/pricing?need=accounts`, 303);
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(`${origin}/pricing?need=signin`, 303);
  const stripe = getStripe();
  if (!stripe) return NextResponse.redirect(`${origin}/pricing?need=stripe`, 303);
  const user = await currentUser();
  const spec = PLANS[plan];
  let url: string | null;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      client_reference_id: userId,
      customer_email: user?.primaryEmailAddress?.emailAddress,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: spec.cents,
            recurring: { interval: "month" },
            product_data: { name: `Vault ${spec.name} (${spec.zh})`, description: spec.tagline, tax_code: spec.taxCode },
          },
        },
      ],
      subscription_data: { metadata: { clerkUserId: userId, plan } },
      metadata: { plan },
      success_url: `${origin}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing?canceled=1`,
    });
    url = session.url;
  } catch (error) {
    console.error("Stripe Checkout failed:", error instanceof Error ? error.message : error);
    return NextResponse.redirect(`${origin}/pricing?need=checkout`, 303);
  }
  return NextResponse.redirect(url ?? `${origin}/pricing`, 303);
}
