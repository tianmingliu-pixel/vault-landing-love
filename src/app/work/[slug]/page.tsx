import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import HardwareCatalog from "../../hardware-catalog";
import LlmResearch from "../../llm-research";
import { workItems } from "../../work-items";
import NetworkResearch from "../../network-research";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return workItems.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = workItems.find((item) => item.slug === slug);
  return {
    title: project ? `${project.title} | Tianming Liu` : "Work | Tianming Liu",
    description: project?.body,
  };
}

export default async function WorkPage({ params }: Props) {
  const { slug } = await params;
  const project = workItems.find((item) => item.slug === slug);
  if (!project) notFound();
  if (slug === "computer-hardware-atlas") return <HardwareCatalog />;
  if (slug === "local-llm-hardening") return <LlmResearch />;
  if (slug === "network-concept") return <NetworkResearch />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight hover:text-emerald-300">首页</Link>
        <Link href="/#work" className="text-sm text-slate-400 hover:text-white">All work &larr;</Link>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24">
        <div className="border-b border-slate-800 pb-12 pt-16 sm:pt-24">
          <p className="mb-5 text-sm font-medium uppercase tracking-widest text-emerald-400">Selected work / {project.tag}</p>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-6xl">{project.title}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-400">{project.body}</p>
        </div>

        <div className="grid gap-16 pt-14 lg:grid-cols-[minmax(0,1fr)_260px]">
          <section aria-labelledby="details-heading">
            <h2 id="details-heading" className="mb-8 text-2xl font-semibold">Project details</h2>
            <div className="divide-y divide-slate-800 border-y border-slate-800">
              {project.highlights.map((highlight, index) => (
                <div key={highlight.title} className="grid gap-3 py-7 sm:grid-cols-[48px_1fr]">
                  <span className="font-mono text-sm text-emerald-400">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3 className="text-lg font-semibold">{highlight.title}</h3>
                    <p className="mt-2 leading-relaxed text-slate-400">{highlight.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <nav aria-label="Other projects" className="lg:border-l lg:border-slate-800 lg:pl-8">
            <h2 className="mb-5 text-sm font-medium uppercase tracking-widest text-slate-500">Other projects</h2>
            <div className="flex flex-col gap-4">
              {workItems.filter((item) => item.slug !== slug).map((item) => (
                <Link key={item.slug} href={`/work/${item.slug}`} className="border-b border-slate-800 pb-4 text-sm font-medium text-slate-300 hover:border-emerald-400 hover:text-emerald-300">
                  {item.title} &rarr;
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </main>
    </div>
  );
}