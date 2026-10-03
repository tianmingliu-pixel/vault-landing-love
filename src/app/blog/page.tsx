import type { Metadata } from "next";
import Link from "next/link";
import SiteHeader from "../site-header";
import { focusAreas } from "../focus-areas";
import { getReader, TIER_LABEL } from "../lib/membership";
import { Cover } from "./art";
import { POSTS } from "./content";
import TierChip from "./tier-chip";

export const metadata: Metadata = { title: "Articles | Tianming Liu", description: "Five deep dives: secure APIs, PyTorch, safe agents, reproducible data systems and open space data." };

export default async function BlogIndex() {
  const reader = await getReader();
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 pb-24">
        <div className="pb-12 pt-10 sm:pt-16">
          <p className="font-mono text-xs uppercase tracking-widest text-emerald-400">Articles</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold sm:text-5xl">Learn it from the primary sources, then build it.</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-400">
            One deep dive for each area I focus on, plus field notes from the live space lab. Every article opens with a free overview, adds a hands-on walkthrough for members and ends in a hands-on lab and a downloadable kit for plan members.
          </p>
          <p className="mt-4 font-mono text-xs text-slate-500">
            You are reading as <span className="text-slate-300">{reader.tier === "anonymous" ? "a guest" : TIER_LABEL[reader.tier]}</span> ·{" "}
            <Link href="/pricing" className="text-fuchsia-300 hover:text-fuchsia-200">plans</Link>
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {POSTS.map((post, k) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className={`group overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 transition hover:border-slate-600 ${k === 0 ? "md:col-span-2" : ""}`}>
              <div className="relative">
                <Cover motif={post.motif} accent={post.accent} className={`w-full transition duration-500 group-hover:scale-[1.02] ${k === 0 ? "h-64" : "h-44"}`} />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent" />
              </div>
              <div className="p-6">
                <p className="font-mono text-[11px] uppercase tracking-widest" style={{ color: post.accent }}>
                  {focusAreas.find((f) => f.slug === post.focus)?.title ?? "Field notes"} · {post.minutes} min
                </p>
                <h2 className="mt-2 text-2xl font-semibold group-hover:text-white">{post.title}</h2>
                <p className="mt-2 text-slate-400">{post.subtitle}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {post.sections.map((s) => <TierChip key={s.id} tier={s.access} />)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
