import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { focusAreas } from "../../focus-areas";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return focusAreas.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const focus = focusAreas.find((area) => area.slug === slug);
  return {
    title: focus ? `${focus.title} | Tianming Liu` : "Focus | Tianming Liu",
    description: focus?.body,
  };
}

export default async function FocusPage({ params }: Props) {
  const { slug } = await params;
  const focus = focusAreas.find((area) => area.slug === slug);
  if (!focus) notFound();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight hover:text-emerald-300">首页</Link>
        <Link href="/#focus" className="text-sm text-slate-400 hover:text-white">All focus areas &larr;</Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <div className="border-b border-slate-800 pb-12 pt-16 sm:pt-24">
          <p className="mb-5 text-sm font-medium uppercase tracking-widest text-emerald-400">What I focus on / {String(focusAreas.indexOf(focus) + 1).padStart(2, "0")}</p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">{focus.title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">{focus.body}</p>
        </div>

        <div className="grid gap-16 pt-14 lg:grid-cols-[minmax(0,1fr)_260px]">
          <section aria-labelledby="topics-heading">
            <h2 id="topics-heading" className="mb-8 text-2xl font-semibold">Areas of interest</h2>
            <div className="divide-y divide-slate-800 border-y border-slate-800">
              {focus.topics.map((topic, index) => (
                <div key={topic.title} className="grid gap-3 py-7 sm:grid-cols-[48px_1fr]">
                  <span className="font-mono text-sm text-emerald-400">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="text-lg font-semibold">{topic.title}</h3>
                    <p className="mt-2 leading-relaxed text-slate-400">{topic.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <nav aria-label="Other focus areas" className="lg:border-l lg:border-slate-800 lg:pl-8">
            <h2 className="mb-5 text-sm font-medium uppercase tracking-widest text-slate-500">Other focus areas</h2>
            <div className="flex flex-col gap-4">
              {focusAreas.filter((area) => area.slug !== slug).map((area) => (
                <Link key={area.slug} href={`/focus/${area.slug}`} className="border-b border-slate-800 pb-4 text-sm font-medium text-slate-300 hover:border-emerald-400 hover:text-emerald-300">
                  {area.title} &rarr;
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </main>
    </div>
  );
}