import Link from "next/link";
import AuthControls from "./auth-controls";
import BackLink from "./back-link";

/** Shared top bar: home, the main sections, articles, pricing and the account controls. */
export default function SiteHeader({ home = false }: { home?: boolean }) {
  const anchor = (id: string) => (home ? `#${id}` : `/#${id}`);
  return (
    <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6">
      <div className="flex items-center gap-3">
        {!home && <BackLink />}
        <Link href="/" className="text-lg font-semibold tracking-tight hover:text-emerald-300">首页</Link>
      </div>
      <nav className="flex flex-wrap items-center gap-5 text-sm text-slate-400">
        <a href={anchor("live")} className="hover:text-white">Live</a>
        <a href={anchor("focus")} className="hover:text-white">Focus</a>
        <a href={anchor("work")} className="hover:text-white">Work</a>
        <Link href="/blog" className="hover:text-white">Articles</Link>
        <Link href="/pricing" className="hover:text-white">Pricing</Link>
        <a href={anchor("contact")} className="hover:text-white">Contact</a>
        <AuthControls />
      </nav>
    </header>
  );
}
