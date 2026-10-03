"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { PaperCard } from "./lib/openalex";

/** A focus module's research stream: tabs per theme, and papers that keep loading as you scroll — there is no last page. */
export function PaperTile({ p, focus, accent, rank }: { p: PaperCard; focus: string; accent: string; rank?: number }) {
  return (
    <Link href={`/focus/${focus}/papers/${p.id}`} className="group relative block overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60 p-4 transition hover:border-slate-500">
      <div aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 opacity-60 transition group-hover:opacity-100" style={{ background: accent }} />
      <p className="flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-widest text-slate-500">
        <span>{rank !== undefined ? `#${String(rank).padStart(3, "0")} · ` : ""}{p.year ?? "—"}{p.venue ? ` · ${p.venue}` : ""}</span>
        {p.open && <span style={{ color: accent }}>open access</span>}
      </p>
      <h3 className="mt-1.5 font-semibold leading-snug text-slate-100 group-hover:text-white">{p.title}</h3>
      <p className="mt-1 truncate text-xs text-slate-500">{p.authors.join(", ")}</p>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded bg-slate-800">
          <div className="h-full rounded" style={{ width: `${Math.min(100, (Math.log10(p.cited + 1) / 5) * 100)}%`, background: accent }} />
        </div>
        <span className="font-mono text-[10px] text-slate-400">{p.cited.toLocaleString("en-US")} citations</span>
      </div>
    </Link>
  );
}

export default function PaperStream({ focus, accent, streams }: { focus: string; accent: string; streams: { label: string }[] }) {
  const [stream, setStream] = useState(0);
  const [state, setState] = useState<{ stream: number; items: PaperCard[]; next: string | null; total: number; loading: boolean; error: boolean }>({ stream: 0, items: [], next: "*", total: 0, loading: false, error: false });
  const sentinel = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const wanted = useRef(0); // the theme the reader last chose; answers for any other theme are dropped

  const load = async (which: number, cursor: string, reset: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setState((s) => ({ ...s, loading: true, error: false }));
    try {
      const r = await fetch(`/api/papers?focus=${focus}&stream=${which}&cursor=${encodeURIComponent(cursor)}`);
      if (!r.ok) throw new Error();
      const page = (await r.json()) as { items: PaperCard[]; next: string | null; total: number };
      if (which !== wanted.current) return;
      setState((s) => {
        const items = reset || s.stream !== which ? page.items : [...s.items, ...page.items.filter((p) => !s.items.some((q) => q.id === p.id))];
        return { stream: which, items, next: page.next, total: page.total, loading: false, error: false };
      });
    } catch {
      setState((s) => ({ ...s, loading: false, error: true }));
    } finally {
      busy.current = false;
    }
  };

  // First page on mount (deferred a tick so the effect itself doesn't set state); later themes load from the tab click.
  useEffect(() => {
    const t = window.setTimeout(() => void load(0, "*", true), 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && state.next && !state.loading && !state.error && state.stream === stream) void load(stream, state.next, false);
    }, { rootMargin: "600px" });
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.next, state.loading, state.error, state.stream, stream]);

  const items = state.stream === stream ? state.items : [];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Research themes">
        {streams.map((s, k) => (
          <button
            key={s.label}
            type="button"
            role="tab"
            aria-selected={stream === k}
            onClick={() => {
              if (k === stream) return;
              setStream(k);
              wanted.current = k;
              busy.current = false;
              void load(k, "*", true);
            }}
            className="rounded border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition"
            style={stream === k ? { borderColor: accent, color: "#020617", background: accent } : { borderColor: "#334155", color: "#94a3b8" }}
          >
            {s.label}
          </button>
        ))}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-slate-500">
          {state.stream === stream && state.total ? `${state.total.toLocaleString("en-US")} papers indexed · sorted by citations` : "scanning…"}
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {items.map((p, k) => <PaperTile key={p.id} p={p} focus={focus} accent={accent} rank={k + 1} />)}
      </div>
      <div ref={sentinel} className="py-8 text-center font-mono text-[11px] uppercase tracking-widest text-slate-500">
        {state.error ? (
          <button type="button" onClick={() => void load(stream, state.next ?? "*", items.length === 0)} className="text-amber-300 hover:text-amber-200">Signal lost — retry</button>
        ) : state.loading || state.next ? (
          <span className="animate-pulse">Receiving more papers…</span>
        ) : (
          "End of index for this theme"
        )}
      </div>
    </div>
  );
}
