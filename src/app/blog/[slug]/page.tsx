import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, Download, Lock } from "lucide-react";
import SiteHeader from "../../site-header";
import { focusAreas } from "../../focus-areas";
import { canRead, getReader, TIER_LABEL } from "../../lib/membership";
import { PLANS } from "../../lib/plans";
import { Cover } from "../art";
import Blocks from "../blocks";
import { POSTS, postBySlug } from "../content";
import TierChip from "../tier-chip";
import UnlockCta from "../unlock-cta";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return POSTS.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = postBySlug((await params).slug);
  return { title: post ? `${post.title} | Tianming Liu` : "Articles | Tianming Liu", description: post?.subtitle };
}

export default async function ArticlePage({ params }: Props) {
  const post = postBySlug((await params).slug);
  if (!post) notFound();
  // Locked sections are never sent to the browser: only their title and teaser are rendered.
  const reader = await getReader();
  const focus = focusAreas.find((f) => f.slug === post.focus);
  const index = POSTS.indexOf(post);
  const next = POSTS[(index + 1) % POSTS.length];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />

      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-none sm:rounded-3xl">
        <Cover motif={post.motif} accent={post.accent} className="h-[300px] w-full sm:h-[380px]" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-12">
          <p className="font-mono text-xs uppercase tracking-widest" style={{ color: post.accent }}>
            {focus ? `What I focus on · ${focus.title}` : "Field notes · Live Earth & Space"}
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight sm:text-5xl">{post.title}</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">{post.subtitle}</p>
          <p className="mt-4 font-mono text-xs text-slate-500">
            {post.date} · {post.minutes} min · reading as <span className="text-slate-300">{reader.tier === "anonymous" ? "guest" : TIER_LABEL[reader.tier].toLowerCase()}</span>
          </p>
        </div>
      </div>

      <main className="mx-auto grid max-w-6xl gap-12 px-6 pb-24 pt-12 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article className="space-y-14">
          {post.sections.map((section) => {
            const open = canRead(reader.tier, section.access);
            return (
              <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-24">
                <div className="mb-5 flex items-center gap-3">
                  <TierChip tier={section.access} />
                  <h2 id={`${section.id}-title`} className="text-2xl font-semibold">{section.title}</h2>
                </div>
                {open ? <Blocks blocks={section.blocks} accent={post.accent} /> : <UnlockCta need={section.access} title={section.title} teaser={section.teaser} accent={post.accent} />}
              </section>
            );
          })}

          <Link href={`/blog/${next.slug}`} className="group block rounded-2xl border border-slate-800 p-6 hover:border-slate-600">
            <span className="font-mono text-[11px] uppercase tracking-widest text-slate-500">Read next</span>
            <span className="mt-1 block text-xl font-semibold group-hover:text-white">{next.title} &rarr;</span>
            <span className="mt-1 block text-slate-400">{next.subtitle}</span>
          </Link>
        </article>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <nav aria-label="In this article" className="rounded-2xl border border-slate-800 p-5">
            <p className="font-mono text-[11px] uppercase tracking-widest text-slate-500">In this article</p>
            <ol className="mt-3 space-y-2 text-sm">
              {post.sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex items-start gap-2 text-slate-300 hover:text-white">
                    {canRead(reader.tier, s.access) ? <Check size={14} className="mt-0.5 shrink-0" style={{ color: post.accent }} aria-hidden="true" /> : <Lock size={14} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />}
                    <span>{s.title}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {/* The premium product for this article. */}
          <div className="relative overflow-hidden rounded-2xl border border-fuchsia-500/40 bg-gradient-to-b from-fuchsia-500/10 via-slate-950 to-slate-950 p-5">
            <div aria-hidden="true" className="absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl" style={{ background: post.accent, opacity: 0.35 }} />
            <p className="relative font-mono text-[11px] uppercase tracking-widest text-cyan-200">Kit · {PLANS.diamond.name} &amp; {PLANS.supreme.name}</p>
            <p className="relative mt-1 text-lg font-semibold">{post.kit.name}</p>
            <p className="relative mt-1 text-sm text-slate-400">{post.kit.tagline}</p>
            <ul className="relative mt-4 space-y-2 text-sm text-slate-300">
              {post.kit.includes.map((item) => (
                <li key={item} className="flex gap-2">
                  <Check size={14} className="mt-1 shrink-0 text-fuchsia-300" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            {canRead(reader.tier, "diamond") ? (
              <a href={`/api/kit/${post.slug}`} className="relative mt-5 flex items-center justify-center gap-2 rounded-lg bg-fuchsia-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-fuchsia-400">
                <Download size={15} aria-hidden="true" /> Download the kit
              </a>
            ) : (
              <Link href="/pricing" className="relative mt-5 block rounded-lg bg-gradient-to-r from-fuchsia-500 to-amber-400 px-4 py-2.5 text-center font-semibold text-slate-950 hover:opacity-90">
                Get it with {PLANS.diamond.name} — $59.99/mo
              </Link>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
