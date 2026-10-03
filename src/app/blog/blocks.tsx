import { ExternalLink } from "lucide-react";
import { Diagram } from "./art";
import type { Block } from "./posts-types";
import VideoEmbed from "./video-embed";

const KIND_LABEL: Record<string, string> = { doc: "Docs", video: "Video", paper: "Paper", course: "Course", book: "Book", standard: "Standard", tool: "Live tool" };

export default function Blocks({ blocks, accent }: { blocks: Block[]; accent: string }) {
  return (
    <div className="space-y-6">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "p":
            return <p key={i} className="text-[17px] leading-relaxed text-slate-300">{b.text}</p>;
          case "h":
            return <h3 key={i} className="pt-2 text-xl font-semibold text-slate-100">{b.text}</h3>;
          case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag key={i} className={`space-y-2 pl-6 text-slate-300 ${b.ordered ? "list-decimal" : "list-disc"}`}>
                {b.items.map((item) => <li key={item} className="leading-relaxed">{item}</li>)}
              </Tag>
            );
          }
          case "code":
            return (
              <figure key={i} className="overflow-hidden rounded-xl border border-slate-800 bg-[#050b1a]">
                <figcaption className="flex items-center justify-between border-b border-slate-800 px-4 py-2 font-mono text-[11px] text-slate-500">
                  <span>{b.title ?? b.lang}</span>
                  <span style={{ color: accent }}>{b.lang}</span>
                </figcaption>
                <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-slate-200"><code>{b.text}</code></pre>
              </figure>
            );
          case "video":
            return <VideoEmbed key={i} {...b} accent={accent} />;
          case "diagram":
            return (
              <figure key={i} className="overflow-hidden rounded-xl border border-slate-800">
                <Diagram name={b.name} accent={accent} />
                <figcaption className="border-t border-slate-800 px-4 py-3 text-sm text-slate-400">{b.caption}</figcaption>
              </figure>
            );
          case "image":
            return (
              <figure key={i} className="overflow-hidden rounded-xl border border-slate-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.src} alt={b.alt} className="w-full" loading="lazy" />
                <figcaption className="px-4 py-2 text-xs text-slate-500">{b.credit}</figcaption>
              </figure>
            );
          case "callout":
            return (
              <div key={i} className={`rounded-xl border-l-4 p-4 text-slate-200 ${b.tone === "warn" ? "border-amber-400 bg-amber-500/5" : "bg-slate-900"}`} style={b.tone === "info" ? { borderColor: accent } : undefined}>
                {b.text}
              </div>
            );
          case "table":
            return (
              <div key={i} className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900 text-slate-400">
                    <tr>{b.head.map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {b.rows.map((row) => (
                      <tr key={row[0]}>{row.map((cell, k) => <td key={k} className={`px-4 py-2 align-top ${k === 0 ? "font-medium text-slate-100" : ""}`}>{cell}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "resources":
            return (
              <div key={i}>
                <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-slate-500">Primary sources</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {b.items.map((r) => (
                    <a key={r.url} href={r.url} rel="noopener noreferrer" className="group rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-slate-600">
                      <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: accent }}>{KIND_LABEL[r.kind]}</span>
                      <span className="mt-1 flex items-start justify-between gap-2 font-semibold text-slate-100">
                        {r.title}
                        <ExternalLink size={14} className="mt-1 shrink-0 text-slate-500 group-hover:text-slate-300" aria-hidden="true" />
                      </span>
                      <span className="block text-xs text-slate-500">{r.by}</span>
                      <span className="mt-2 block text-sm text-slate-400">{r.note}</span>
                    </a>
                  ))}
                </div>
              </div>
            );
        }
      })}
    </div>
  );
}
