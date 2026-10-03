import Link from "next/link";
import { focusAreas } from "./focus-areas";
import GlobeScene from "./globe-scene";
import { workItems } from "./work-items";
import LiveSpaceDeck from "./live-space-deck";
import SiteHeader from "./site-header";
import { Cover } from "./blog/art";
import { POSTS } from "./blog/content";
import TierChip from "./blog/tier-chip";

/** Newest whole-Earth image from NASA's EPIC camera (published a few days after it is taken). */
async function latestEarth(): Promise<{ src: string; taken: string } | null> {
  try {
    const list = await fetch("https://epic.gsfc.nasa.gov/api/natural", { next: { revalidate: 3600 } }).then((r) => r.json() as Promise<{ image: string; date: string }[]>);
    // The frame closest to local noon over the Americas/Atlantic is usually in the middle of the day's set.
    const pick = list[Math.floor(list.length / 2)];
    if (!pick) return null;
    const [day] = pick.date.split(" ");
    const [y, m, d] = day.split("-");
    return { src: `https://epic.gsfc.nasa.gov/archive/natural/${y}/${m}/${d}/jpg/${pick.image}.jpg`, taken: pick.date.replace(" ", "T") };
  } catch {
    return null;
  }
}

const GITHUB_URL = "https://github.com/tianmingliu-pixel";
export default async function Home() {
  const year = new Date().getFullYear();
  const earth = await latestEarth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader home />

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
               
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-700 px-6 py-3 font-semibold hover:border-slate-500"
              >
                GitHub
              </a>
            </div>
          </div>
          <GlobeScene />
        </section>

        {/* Live Earth & Space */}
        <LiveSpaceDeck earth={earth} />

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

        {/* Articles */}
        <section id="articles" className="py-16">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">Articles</h2>
              <p className="mt-2 max-w-2xl text-slate-400">One deep dive per focus area plus field notes from the space lab — free overviews, walkthroughs for Google sign-in members, and labs and kits on the Platinum, Diamond and Supreme plans.</p>
            </div>
            <Link href="/pricing" className="rounded-lg border border-fuchsia-500/50 px-4 py-2 text-sm font-semibold text-fuchsia-200 hover:bg-fuchsia-500/10">See plans &rarr;</Link>
          </div>
          <div className="grid gap-6 md:grid-cols-6">
            {POSTS.map((post, k) => (
              <Link key={post.slug} href={`/blog/${post.slug}`} className={`group overflow-hidden rounded-xl border border-slate-800 bg-slate-900 transition-colors hover:border-emerald-500/60 ${k < 2 ? "md:col-span-3" : "md:col-span-2"}`}>
                <div className="relative">
                  <Cover motif={post.motif} accent={post.accent} className="h-36 w-full transition duration-500 group-hover:scale-[1.03]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
                </div>
                <div className="p-5">
                  <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: post.accent }}>{post.minutes} min · {post.kit.name}</p>
                  <h3 className="mt-1 font-semibold">{post.title}</h3>
                  <div className="mt-3 flex gap-1.5">{post.sections.map((sec) => <TierChip key={sec.id} tier={sec.access} />)}</div>
                </div>
              </Link>
            ))}
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


