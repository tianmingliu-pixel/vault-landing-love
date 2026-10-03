"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ISS_STREAMS, IssPlayer } from "./orbit-timelapse";

/* Home-page "Live Earth & Space" deck: the live 3D solar system and the live Sun side by side, then three windows onto
   the full Network Concept page — the cable and land networks, the satellite layer and the ISS live video. */

const SolarSystem = dynamic(() => import("./solar-system"), { ssr: false, loading: () => <Placeholder label="Loading the solar system…" /> });
const SunPanel = dynamic(() => import("./sun-panel"), { ssr: false, loading: () => <Placeholder label="Loading the Sun…" /> });

function Placeholder({ label }: { label: string }) {
  return <div className="grid aspect-square place-items-center rounded-xl border border-slate-800 bg-slate-950 font-mono text-xs text-slate-500">{label}</div>;
}

const GOES_EAST = "https://cdn.star.nesdis.noaa.gov/GOES19/ABI/FD/GEOCOLOR/678x678.jpg";

export default function LiveSpaceDeck({ earth }: { earth: { src: string; taken: string } | null }) {
  return (
    <section id="live" aria-labelledby="live-title" className="py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-emerald-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
            Live · open data
          </p>
          <h2 id="live-title" className="mt-2 text-2xl font-bold sm:text-3xl">Live Earth &amp; Space</h2>
          <p className="mt-2 max-w-2xl text-slate-400">
            The planets where they are right now, the Sun as NOAA and NASA see it this hour, and the cables, satellites and stations that carry
            our data — all from public sources, updated in your browser.
          </p>
        </div>
        <Link href="/work/network-concept" className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-emerald-500/60">
          Open the full lab &rarr;
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <SolarSystem compact />
        <SunPanel compact />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <Link href="/work/network-concept#global-title" className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900 transition-colors hover:border-emerald-500/60">
          <div className="relative aspect-[4/3] overflow-hidden bg-black">
            {earth ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={earth.src} alt={`The whole sunlit Earth from NASA's EPIC camera, ${earth.taken.slice(0, 16).replace("T", " ")} UTC`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            ) : (
              <div className="grid h-full place-items-center text-xs text-slate-500">Earth from L1</div>
            )}
            <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-sky-200">NASA EPIC · {earth ? earth.taken.slice(0, 10) : "—"}</span>
          </div>
          <div className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">Cables &amp; land networks</p>
            <h3 className="mt-1 font-semibold">How the world is wired</h3>
            <p className="mt-1 text-sm text-slate-400">Submarine cables, exchanges and city-to-city links on a 3D globe, with measured traceroutes.</p>
          </div>
        </Link>

        <Link href="/work/network-concept#orbit-title" className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-900 transition-colors hover:border-emerald-500/60">
          <div className="relative aspect-[4/3] overflow-hidden bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={GOES_EAST} alt="Latest GOES-19 GeoColor full-disk image of the Americas" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
            <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-sky-200">NOAA GOES-19 · latest</span>
          </div>
          <div className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">Satellites</p>
            <h3 className="mt-1 font-semibold">14,000+ satellites, live</h3>
            <p className="mt-1 text-sm text-slate-400">Every tracked satellite, its operator and what it does — imagery, radio links and ground stations.</p>
          </div>
        </Link>

        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
          <div className="bg-black">
            <IssPlayer streamId={ISS_STREAMS[1].id} title="Live HD Earth views from the International Space Station" />
          </div>
          <div className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-rose-300">Live video</p>
            <h3 className="mt-1 font-semibold">Service open soon</h3>
            <p className="mt-1 text-sm text-slate-400">24/7 stream from 420 km up. During loss of signal the station camera feed goes dark.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
