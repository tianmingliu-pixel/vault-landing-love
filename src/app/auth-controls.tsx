"use client";

import { Show, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { clerkEnabled } from "./lib/clerk-enabled";
import { isPaidPlan, PLANS } from "./lib/plans";

/** Sign in / join for visitors; avatar and plan badge for members. */
export default function AuthControls() {
  if (!clerkEnabled) return <Link href="/pricing" className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:border-slate-500">Plans</Link>;
  return <ClerkControls />;
}

function ClerkControls() {
  const { user } = useUser();
  const plan = (user?.publicMetadata as { plan?: string } | undefined)?.plan;
  const paid = isPaidPlan(plan) ? PLANS[plan] : null;
  return (
    <div className="flex items-center gap-3 text-sm">
      <Show when="signed-out">
        {/* Accounts are Google-only (configured in the Clerk dashboard), so one button covers sign-in and sign-up. */}
        <SignInButton mode="modal">
          <button type="button" className="flex items-center gap-2 rounded-full bg-white px-3 py-1 font-semibold text-slate-900 hover:bg-slate-200">
            <GoogleMark /> Sign in with Google
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        {paid ? (
          <span className="rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest" style={{ borderColor: paid.color, color: paid.color }}>{paid.name}</span>
        ) : (
          <Link href="/pricing" className="rounded-full border border-fuchsia-400/50 px-2.5 py-0.5 text-xs text-fuchsia-200 hover:bg-fuchsia-500/10">Upgrade</Link>
        )}
        <UserButton />
      </Show>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="14" height="14" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
