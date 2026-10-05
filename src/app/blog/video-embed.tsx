"use client";

import { useState } from "react";
import { Play } from "lucide-react";

/** A YouTube video that loads only when clicked (privacy-enhanced domain, no third-party requests before that). */
export default function VideoEmbed({ id, title, by, note, accent }: { id: string; title: string; by: string; note: string; accent: string }) {
  const [on, setOn] = useState(false);
  return (
    <figure className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="relative aspect-video bg-black">
        {on ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button type="button" onClick={() => setOn(true)} className="group absolute inset-0" aria-label={`Play: ${title}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100" />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid h-14 w-14 place-items-center rounded-full shadow-lg transition group-hover:scale-110" style={{ background: accent }}>
                <Play size={22} className="ml-0.5 text-slate-950" fill="currentColor" aria-hidden="true" />
              </span>
            </span>
          </button>
        )}
      </div>
      <figcaption className="p-4">
        <p className="font-semibold text-slate-100">{title}</p>
        <p className="font-mono text-[11px] text-slate-500">{by}</p>
        <p className="mt-1 text-sm text-slate-400">{note}</p>
      </figcaption>
    </figure>
  );
}
