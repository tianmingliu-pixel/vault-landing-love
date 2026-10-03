import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "../../site-header";
import { focusAreas } from "../../focus-areas";
import { FOCUS_RESEARCH } from "../../focus-research";
import { Hud } from "../../hud";
import { landmarkPapers, type PaperCard } from "../../lib/openalex";
import PaperStream, { PaperTile } from "../../paper-stream";
import { postBySlug } from "../../blog/content";
import { Cover } from "../../blog/art";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return focusAreas.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const focus = focusAreas.find((area) => area.slug === slug);
  return { title: focus ? `${focus.title} | Tianming Liu` : "Focus | Tianming Liu", description: focus?.body };
}

export default async function FocusPage({ params }: Props) {
  const { slug } = await params;
  const focus = focusAreas.find((area) => area.slug === slug);
  const research = FOCUS_RESEARCH[slug];
  if (!focus || !research) notFound();
  const index = focusAreas.indexOf(focus) + 1;
  const accent = research.accent;
  const article = postBySlug(research.article);
  let canon: PaperCard[] = [];
  try {
    canon = await landmarkPapers(research.canon);
  } catch {
    canon = [];
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#02040b] text-slate-100">
      {/* Backdrop: grid, glow and scanlines. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 h-[36rem] w-[60rem] -translate-x-1/2 rounded-full blur-3xl" style={{ background: accent, opacity: 0.12 }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(180deg,transparent_0_3px,rgba(255,255,255,0.015)_3px_4px)]" />

      <div className="relative">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-6 pb-24">
          {/* Hero */}
          <section className="grid gap-8 pb-12 pt-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.3em]" style={{ color: accent }}>
                Module {String(index).padStart(2, "0")} / {String(focusAreas.length).padStart(2, "0")} · what I focus on
              </p>
              <h1 className="mt-4 text-4xl font-bold leading-[1.05] sm:text-6xl" style={{ textShadow: `0 0 40px ${accent}55` }}>{focus.title}</h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">{focus.body}</p>
            </div>
            <Hud accent={accent} label="system status" className="p-5">
              <dl className="space-y-2 font-mono text-xs">
                <div className="flex justify-between"><dt className="text-slate-500">landmark papers</dt><dd style={{ color: accent }}>{canon.length}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">research streams</dt><dd style={{ color: accent }}>{research.streams.length}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">index</dt><dd className="text-slate-300">OpenAlex · 250M+ works</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">feed</dt><dd className="text-slate-300">endless · by citations</dd></div>
              </dl>
              <div className="mt-4 h-1 overflow-hidden rounded bg-slate-800"><div className="h-full w-2/3 animate-pulse rounded" style={{ background: accent }} /></div>
            </Hud>
          </section>

          {/* Sub-modules */}
          <section aria-labelledby="modules" className="grid gap-5 md:grid-cols-3">
            <h2 id="modules" className="sr-only">Areas of interest</h2>
            {focus.topics.map((topic, k) => (
              <Hud key={topic.title} accent={accent} label={`sub-module ${index}.${k + 1}`} className="p-6 pt-7">
                <h3 className="text-lg font-semibold text-slate-100">{topic.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{topic.detail}</p>
              </Hud>
            ))}
          </section>

          {/* The matching article */}
          {article && (
            <Link href={`/blog/${article.slug}`} className="group mt-12 grid overflow-hidden rounded-2xl border border-slate-800 transition hover:border-slate-600 md:grid-cols-[320px_1fr]">
              <Cover motif={article.motif} accent={article.accent} className="h-48 w-full md:h-full" />
              <div className="bg-slate-950/80 p-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: accent }}>Field article · {article.minutes} min</p>
                <p className="mt-2 text-2xl font-semibold group-hover:text-white">{article.title}</p>
                <p className="mt-2 text-slate-400">{article.subtitle}</p>
                <p className="mt-4 text-sm font-semibold" style={{ color: accent }}>Read the article &rarr;</p>
              </div>
            </Link>
          )}

          {/* Canon */}
          <section aria-labelledby="canon" className="mt-16">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">archive · canon</p>
                <h2 id="canon" className="mt-1 text-2xl font-semibold">Landmark papers</h2>
              </div>
              <p className="max-w-md text-right text-sm text-slate-500">The papers the field still builds on. Open any of them for its abstract, authors, citation trail and where the idea went next.</p>
            </div>
            {canon.length ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {canon.map((p) => <PaperTile key={p.id} p={p} focus={slug} accent={accent} />)}
              </div>
            ) : (
              <p className="font-mono text-xs text-slate-500">Archive offline — the paper index could not be reached. Refresh to retry.</p>
            )}
          </section>

          {/* Endless stream */}
          <section aria-labelledby="stream" className="mt-16">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">live index · endless</p>
            <h2 id="stream" className="mb-5 mt-1 text-2xl font-semibold">Research stream</h2>
            <PaperStream focus={slug} accent={accent} streams={research.streams} />
          </section>

          <nav aria-label="Other focus areas" className="mt-16 grid gap-3 border-t border-slate-800 pt-8 sm:grid-cols-3">
            {focusAreas.filter((area) => area.slug !== slug).map((area) => (
              <Link key={area.slug} href={`/focus/${area.slug}`} className="rounded-lg border border-slate-800 p-4 text-sm text-slate-300 hover:border-slate-600 hover:text-white">
                <span className="block font-mono text-[10px] uppercase tracking-widest text-slate-500">Module {String(focusAreas.indexOf(area) + 1).padStart(2, "0")}</span>
                {area.title} &rarr;
              </Link>
            ))}
          </nav>
        </main>
      </div>
    </div>
  );
}
