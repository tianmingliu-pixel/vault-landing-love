"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/** "Back" that behaves like the browser's back button (returns to the page you came from, at the same scroll position);
    opened directly with no history, it goes to `fallback` instead. */
export default function BackLink({ fallback = "/", label = "Back", className = "" }: { fallback?: string; label?: string; className?: string }) {
  const router = useRouter();
  return (
    <a
      href={fallback}
      onClick={(event) => {
        if (window.history.length > 1) {
          event.preventDefault();
          router.back();
        }
      }}
      className={`inline-flex items-center gap-1.5 rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:border-slate-500 hover:text-white ${className}`}
    >
      <ArrowLeft size={14} aria-hidden="true" /> {label}
    </a>
  );
}
