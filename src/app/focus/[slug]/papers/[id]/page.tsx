import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FileText } from "lucide-react";
import SiteHeader from "../../../../site-header";
import { focusAreas } from "../../../../focus-areas";
import { FOCUS_RESEARCH } from "../../../../focus-research";
import { Hud } from "../../../../hud";
import { citedBy, paper, papersById, type Paper, type PaperCard } from "../../../../lib/openalex";
import { PaperTile } from "../../../../paper-stream";

type Props = { params: Promise<{ slug: string; id: string }> };

async function load(id: string): Promise<Paper | null> {
  if (!/^W\d+$/.test(id)) return null;
  try {
    return await paper(id);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await load((await params).id);
  return { title: p ? `${p.title} | Research dossier` : "Paper", description: p?.abstract?.slice(0, 160) };
}

// A paper's dossier: everything below comes from OpenAlex's record of the paper; following "related" and "cited by"
// links walks the citation graph without end.
export default async function PaperPage({ params }: Props) {
  const { slug, id } = await params;
  const focus = focusAreas.find((f) => f.slug === slug);
  const research = FOCUS_RESEARCH[slug];
  const p = await load(id);
  if (!focus || !research || !p) notFound();
  const accent = research.accent;
  const [related, onward] = await Promise.all([papersById(p.related).catch((): PaperCard[] => []), citedBy(p.id).catch((): PaperCard[] => [])]);
  const age = p.year ? new Date().getFullYear() - p.year : null;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#02040b] text-slate-100">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-[size:48px_48px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 right-0 h-[30rem] w-[40rem] rounded-full blur-3xl" style={{ background: accent, opacity: 0.1 }} />
      <div className="relative">
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-6 pb-24">
          <p className="pt-6 font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: accent }}>
            <Link href={`/focus/${slug}`} className="hover:underline">{focus.title}</Link> · research dossier · {p.id}
          </p>
          <h1 className="mt-4 max-w-4xl text-3xl font-bold leading-tight sm:text-5xl">{p.title}</h1>
          <p className="mt-4 max-w-4xl text-slate-300">{p.authors.slice(0, 12).join(", ")}{p.authors.length > 12 ? ` and ${p.authors.length - 12} more` : ""}</p>
          {p.institutions.length > 0 && <p className="mt-1 text-sm text-slate-500">{p.institutions.join(" · ")}</p>}

          <div className="mt-8 grid gap-4 sm:grid-cols-4">
            {[
              ["published", `${p.year ?? "—"}${age !== null ? ` · ${age} yr ago` : ""}`],
              ["venue", p.venue ?? "—"],
              ["cited by", p.cited.toLocaleString("en-US")],
              ["references", p.references.toLocaleString("en-US")],
            ].map(([k, v]) => (
              <Hud key={k} accent={accent} className="p-4">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{k}</p>
                <p className="mt-1 font-semibold">{v}</p>
              </Hud>
            ))}
          </div>

          <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
            <article>
              <h2 className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-500">Abstract</h2>
              <p className="mt-3 text-[17px] leading-relaxed text-slate-300">{p.abstract ?? "No abstract is available in the open index for this paper. Follow the source link for the full text."}</p>
              {(p.topics.length > 0 || p.keywords.length > 0) && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {[...p.topics, ...p.keywords].map((t) => (
                    <span key={t} className="rounded border border-slate-700 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">{t}</span>
                  ))}
                </div>
              )}
            </article>
            <aside className="space-y-3">
              {p.pdf && (
                <a href={p.pdf} rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold text-slate-950" style={{ background: accent }}>
                  <FileText size={16} aria-hidden="true" /> Read the full paper (PDF)
                </a>
              )}
              {p.landing && (
                <a href={p.landing} rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-3 text-sm font-semibold hover:border-slate-500">
                  Publisher page <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
              {p.doi && <p className="break-all text-center font-mono text-[10px] text-slate-500">{p.doi.replace("https://doi.org/", "doi: ")}</p>}
              <p className="text-xs leading-relaxed text-slate-500">Record from OpenAlex (CC0). Citation counts update weekly.</p>
            </aside>
          </div>

          {onward.length > 0 && (
            <section className="mt-16">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">signal propagation</p>
              <h2 className="mb-5 mt-1 text-2xl font-semibold">Where the idea went next</h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{onward.map((q) => <PaperTile key={q.id} p={q} focus={slug} accent={accent} />)}</div>
            </section>
          )}
          {related.length > 0 && (
            <section className="mt-16">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">adjacent signals</p>
              <h2 className="mb-5 mt-1 text-2xl font-semibold">Related papers</h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{related.map((q) => <PaperTile key={q.id} p={q} focus={slug} accent={accent} />)}</div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
