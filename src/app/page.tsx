import Link from "next/link";
import { focusAreas } from "./focus-areas";
import GlobeScene from "./globe-scene";
import { workItems } from "./work-items";

const GITHUB_URL = "https://github.com/tianmingliu-pixel";
export default function Home() {
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold tracking-tight">首页</span>
        <nav className="flex gap-6 text-sm text-slate-400">
          <a href="#focus" className="hover:text-white">Focus</a>
          <a href="#work" className="hover:text-white">Work</a>
          <a href="#contact" className="hover:text-white">Contact</a>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        {/* Hero */}
        <section className="grid items-center gap-2 py-8 sm:py-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-4 lg:py-16">
          <div className="relative z-10">
            <p className="mb-4 text-sm font-medium uppercase tracking-widest text-emerald-400">
              Scientist · Graduate student at CSTU
            </p>
            <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
              Building AI software that is secure by design
              <span className="mt-2 block text-emerald-300">创建安全的AI Agent软件集.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-slate-400 sm:text-lg">
              I work where agentic AI, deep learning, and secure software engineering meet —
              shipping useful systems without leaving the door open.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 sm:mt-8">
              <a
                href="#work"
                className="rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-slate-950 hover:bg-emerald-400"
              >
                See my work
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-700 px-6 py-3 font-semibold hover:border-slate-500"
              >
                GitHub
              </a>
            </div>
          </div>
          <GlobeScene />
        </section>

        {/* Focus areas */}
        <section id="focus" className="py-16">
          <h2 className="mb-8 text-2xl font-bold">What I focus on</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {focusAreas.map((f) => (
              <Link key={f.slug} href={`/focus/${f.slug}`} className="group rounded-xl border border-slate-800 bg-slate-900 p-6 transition-colors hover:border-emerald-500/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400">
                <h3 className="mb-2 font-semibold text-emerald-400">{f.title}</h3>
                <p className="text-slate-400">{f.body}</p>
                <span aria-hidden="true" className="mt-5 block text-sm font-medium text-emerald-300 group-hover:text-emerald-200">Explore &rarr;</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Work */}
        <section id="work" className="py-16">
          <h2 className="mb-8 text-2xl font-bold">Selected work</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {workItems.map((w) => (
              <Link key={w.slug} href={`/work/${w.slug}`} className="group flex flex-col rounded-xl border border-slate-800 bg-slate-900 p-6 transition-colors hover:border-emerald-500/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400">
                <span className="mb-3 w-fit rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300">
                  {w.tag}
                </span>
                <h3 className="mb-2 font-semibold">{w.title}</h3>
                <p className="text-sm text-slate-400">{w.body}</p>
                <span aria-hidden="true" className="mt-5 block text-sm font-medium text-emerald-300 group-hover:text-emerald-200">View project &rarr;</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Writing teaser (blog comes in step 7) */}
        <section className="py-16">
          <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
            <h2 className="mb-2 text-2xl font-bold">Writing</h2>
            <p className="text-slate-400">
              Notes on security, AI, and learning in public — coming soon.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="py-24 text-center">
          <h2 className="mb-4 text-3xl font-bold">Let&apos;s connect</h2>
          <p className="mb-8 text-slate-400">
            Interested in secure AI systems or want to collaborate? Reach out on GitHub.
          </p>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-emerald-500 px-8 py-3 font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Find me on GitHub
          </a>
        </section>
      </main>

      <footer className="border-t border-slate-800 py-8 text-center text-sm text-slate-500">
        © {year} tianming Liu · Built with Next.js, deployed on Vercel
      </footer>
    </div>
  );
}


