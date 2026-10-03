"use client";

import { SignInButton } from "@clerk/nextjs";
import { clerkEnabled } from "../lib/clerk-enabled";

export default function JoinButton({ label = "Sign in with Google" }: { label?: string }) {
  if (!clerkEnabled) return <p className="rounded-lg border border-slate-700 px-4 py-3 text-center text-sm text-slate-400">Accounts not configured yet</p>;
  return (
    <SignInButton mode="modal" forceRedirectUrl="/pricing">
      <button type="button" className="w-full rounded-lg bg-sky-400 px-4 py-3 font-semibold text-slate-950 hover:bg-sky-300">{label}</button>
    </SignInButton>
  );
}
