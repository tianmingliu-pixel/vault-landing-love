# Deploying vault-landing-love

The site runs without any keys (everyone reads as a guest). Accounts (Google sign-in only) switch on with the two Clerk
keys, and the Platinum $19.99 / Diamond $59.99 / Supreme $99.99 monthly plans with the two Stripe keys.

| Variable | Where it comes from | Needed for |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API keys (`pk_test_…`) | sign-up / sign-in (baked in at build time) |
| `CLERK_SECRET_KEY` | Clerk dashboard → API keys (`sk_test_…`) | reading the session on the server |
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API keys, **test mode** (`sk_test_…`) | Pro checkout |
| `STRIPE_WEBHOOK_SECRET` | the webhook endpoint you create (`whsec_…`) | keeping plans in step with renewals, switches and cancellations |
| `ADMIN_EMAILS` | your Google account email(s) | the owner-only `/stats` dashboard |
| `OPENALEX_API_KEY` | free key from openalex.org, optional | higher daily quota for the research feeds on the focus pages (results are cached a week either way) |
| `NEXT_PUBLIC_GA_ID` | Google Analytics 4 → Admin → Data streams (`G-…`), optional | visitor stats on Cloud Run |

## 0 · Local setup (once)

1. Create a free Clerk application at https://dashboard.clerk.com. **Google only:** in *Configure → User & authentication*,
   turn **off** Email address, Phone and Username as sign-in options and turn **on** *SSO connections → Google*.
   The sign-in window then shows only "Continue with Google". Copy the two keys.
2. Create a free Stripe account at https://dashboard.stripe.com and stay in **Test mode**. Copy the secret key.
3. `copy .env.example .env.local` and paste the keys.
4. Optional, for the webhook locally: install the Stripe CLI, then `stripe login` and
   `stripe listen --forward-to localhost:3000/api/stripe/webhook` — paste the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
5. `npm run dev`, sign in with Google, open **Pricing**, choose a plan, pay with card `4242 4242 4242 4242`, any future date, any CVC.
   Choosing a different plan later switches you to it and cancels the old subscription automatically.
6. In Stripe test mode, open Settings → Billing → Customer portal and click **Save** once so "Manage subscription" works.

## Visitor statistics

- **Vercel:** project → *Analytics* → Enable Web Analytics (and *Speed Insights*). The `<Analytics />` component is already
  in the layout; after the next deploy you see visitors, page views, top pages, countries, referrers and devices.
- **Cloud Run:** create a GA4 property, set `NEXT_PUBLIC_GA_ID`, rebuild; stats appear in Google Analytics.
- **`/stats`** (owner only, by `ADMIN_EMAILS`): signed-up users, accounts per plan, active subscriptions and monthly recurring revenue.

## Getting paid into your bank account

Stripe pays out to the bank account you connect: Stripe dashboard → *Settings → Business → Bank accounts and currency*
(payouts arrive on a rolling schedule, usually 2 business days in the US). To also accept payment straight from a customer's
US bank account (ACH), turn on *Settings → Payments → Payment methods → ACH Direct Debit*; Checkout then offers it automatically.
Real money only moves after Stripe verifies your business and you switch to **live** keys (`sk_live_…`, `pk_live_…`).
Card numbers and bank logins are entered on Stripe's page only; this site never sees them.

## 1 · Vercel (default public URL)

**With Git (recommended)**

```bash
git add -A && git commit -m "Live Earth & Space home, articles with Clerk + Stripe, deployment config"
# create an empty repo on GitHub first, then:
git remote add origin https://github.com/tianmingliu-pixel/vault-landing-love.git
git push -u origin master
```

Then https://vercel.com/new → Import the repo → add the four environment variables → Deploy.
Every later `git push` redeploys.

**Or with the Vercel CLI**

```bash
npm i -g vercel
vercel login
vercel                 # first run links the project and makes a preview deployment
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_WEBHOOK_SECRET
vercel env add ADMIN_EMAILS
vercel --prod          # production URL, e.g. https://vault-landing-love.vercel.app
```

After the first deploy, in Stripe (test mode) → Developers → Webhooks → **Add endpoint**:
`https://<your-domain>/api/stripe/webhook`, events `customer.subscription.created`, `customer.subscription.updated`,
`customer.subscription.deleted`. Put its signing secret in `STRIPE_WEBHOOK_SECRET` and redeploy.

## 2 · Advanced: Google Cloud Run with the gcloud CLI

Uses the `Dockerfile` in this repo (Next.js standalone output, Node 22, port 8080).

```bash
# one-time
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

# the publishable key is public and must exist at build time
echo NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx > .env.production
echo NEXT_PUBLIC_GA_ID=G-XXXXXXX >> .env.production   # optional, for visitor stats

# secrets live in Secret Manager, not in the image
printf "sk_test_xxx" | gcloud secrets create clerk-secret-key --data-file=-
printf "sk_test_xxx" | gcloud secrets create stripe-secret-key --data-file=-
printf "whsec_xxx"   | gcloud secrets create stripe-webhook-secret --data-file=-
# let Cloud Run's runtime service account read them (replace PROJECT_NUMBER)
for s in clerk-secret-key stripe-secret-key stripe-webhook-secret; do
  gcloud secrets add-iam-policy-binding $s \
    --member=serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com \
    --role=roles/secretmanager.secretAccessor
done

# build in Cloud Build and deploy
gcloud run deploy vault-landing-love \
  --source . \
  --region us-west1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --set-env-vars NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx,ADMIN_EMAILS=you@gmail.com \
  --set-secrets CLERK_SECRET_KEY=clerk-secret-key:latest,STRIPE_SECRET_KEY=stripe-secret-key:latest,STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest
```

The command prints a `https://vault-landing-love-…run.app` URL. Add a second Stripe webhook endpoint for that URL.
To update: run the same `gcloud run deploy` again. To remove: `gcloud run services delete vault-landing-love --region us-west1`.

Cost: Cloud Run's free tier covers a course project; it scales to zero when nobody is visiting.

## Notes

- Dev keys from a Clerk *development* instance are fine for this project on both hosts; switch to a production
  instance and your own domain before taking real users.
- Planet surface maps in `public/textures` are from Solar System Scope (CC BY 4.0); keep the credit on the page.
