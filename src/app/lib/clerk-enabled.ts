/** Accounts switch on when the Clerk keys are set (see DEPLOY.md). Without them the site still runs: everyone reads as a guest. */
export const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
