"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Pause, Play, X } from "lucide-react";
import { ISS_STREAMS, IssPlayer } from "./orbit-timelapse";

/* Click a body in the solar system → everything the open spacecraft fleet is sending back about it:
   who is watching it, which of them a Deep Space Network antenna is receiving right now (and how strong, how far,
   how late the signal is), the newest downlinked images against those of a day earlier, measured data, and NASA video. */

export type BodyLink = {
  station: string; dish: string; code: string; name: string; downRate: number; band: string; activity: string; power: number | null; rangeKm: number | null;
};

type Item = { t: string; received?: string; src: string; full?: string; title: string; by: string; group?: string };
type Video = { t: string; title: string; thumb: string; mp4: string; page: string };
type MoonGeo = { time: string; phase: number; age: number; diameter: number; distance: number; subearth_lon: number; subearth_lat: number; posangle: number };
type Weather = { sol: string; date: string; min: string; max: string; pressure: string; ground_min: string; ground_max: string; uv: string; opacity: string; ls: string };
type Intel = {
  body: string;
  generated: string;
  error?: string;
  imagery?: { now: Item[]; before: Item[]; nowLabel: string; beforeLabel: string; note: string; movie?: boolean };
  weather?: Weather[];
  moon?: { now: MoonGeo; before: MoonGeo };
  archive: { images: Item[]; videos: Video[] };
};

type Watcher = { name: string; agency: string; role: string; codes?: string[]; data?: string };

/** The missions watching each body, with the DSN codes they answer to (status comes live from the DSN, not from this list). */
export const WATCHERS: Record<string, Watcher[]> = {
  Sun: [
    { name: "SOHO", agency: "ESA/NASA", role: "coronagraphs, L1", codes: ["SOHO"], data: "https://soho.nascom.nasa.gov/data/realtime-images.html" },
    { name: "Parker Solar Probe", agency: "NASA", role: "flies through the corona", codes: ["SPP"], data: "https://parkersolarprobe.jhuapl.edu/" },
    { name: "STEREO-A", agency: "NASA", role: "side view of the Sun", codes: ["STA"], data: "https://stereo-ssc.nascom.nasa.gov/beacon/" },
    { name: "SDO", agency: "NASA", role: "full-disk imaging every 12 s (own ground station)", data: "https://sdo.gsfc.nasa.gov/data/" },
    { name: "GOES-19 SUVI", agency: "NOAA", role: "operational EUV imager", data: "https://www.swpc.noaa.gov/products/goes-solar-ultraviolet-imager-suvi" },
    { name: "ACE / Wind / DSCOVR / SWFO-L1", agency: "NASA/NOAA", role: "solar wind at L1", codes: ["ACE", "WIND", "DSCO", "SWFO"] },
  ],
  Mercury: [
    { name: "BepiColombo", agency: "ESA/JAXA", role: "two orbiters, arriving at Mercury", codes: ["BEPI"], data: "https://www.cosmos.esa.int/web/bepicolombo" },
    { name: "MESSENGER (archive)", agency: "NASA", role: "orbited 2011–2015", data: "https://pds-imaging.jpl.nasa.gov/volumes/messenger.html" },
  ],
  Venus: [
    { name: "Akatsuki (archive)", agency: "JAXA", role: "orbiter, contact lost 2024", codes: ["PLC"], data: "https://darts.isas.jaxa.jp/planet/project/akatsuki/" },
    { name: "Parker Solar Probe", agency: "NASA", role: "Venus gravity-assist flybys", codes: ["SPP"] },
  ],
  Earth: [
    { name: "DSCOVR / EPIC", agency: "NOAA/NASA", role: "whole sunlit Earth from L1", codes: ["DSCO"], data: "https://epic.gsfc.nasa.gov/" },
    { name: "ISS", agency: "NASA et al.", role: "live HD video (on the satellite layer)", data: "https://www.nasa.gov/live" },
    { name: "GOES / Himawari / Meteosat", agency: "NOAA/JMA/EUMETSAT", role: "geostationary weather imagery", data: "https://www.star.nesdis.noaa.gov/goes/" },
  ],
  Moon: [
    { name: "Lunar Reconnaissance Orbiter", agency: "NASA", role: "mapping orbiter since 2009", codes: ["LRO"], data: "https://www.lroc.asu.edu/" },
    { name: "Danuri (KPLO)", agency: "KARI", role: "orbiter", codes: ["KPLO"], data: "https://www.kari.re.kr/eng/" },
    { name: "Chandrayaan-2", agency: "ISRO", role: "orbiter", codes: ["CH2", "CH2O"], data: "https://pradan.issdc.gov.in/" },
    { name: "ARTEMIS P1 / P2", agency: "NASA", role: "plasma probes in lunar orbit", codes: ["THB", "THC"] },
    { name: "CAPSTONE", agency: "NASA", role: "NRHO pathfinder", codes: ["CAPS"] },
    { name: "Artemis (Orion)", agency: "NASA", role: "crewed missions, video when flying", codes: ["EM2", "EM3"], data: "https://www.nasa.gov/live" },
  ],
  Mars: [
    { name: "Perseverance", agency: "NASA", role: "rover, Jezero crater", codes: ["M20"], data: "https://science.nasa.gov/mission/mars-2020-perseverance/raw-images/" },
    { name: "Curiosity", agency: "NASA", role: "rover, Gale crater", codes: ["MSL"], data: "https://science.nasa.gov/mission/msl-curiosity/raw-images/" },
    { name: "Mars Reconnaissance Orbiter", agency: "NASA", role: "HiRISE, relay", codes: ["MRO", "MROS"], data: "https://www.uahirise.org/" },
    { name: "MAVEN", agency: "NASA", role: "upper atmosphere, relay", codes: ["MVN"] },
    { name: "Mars Odyssey", agency: "NASA", role: "relay, THEMIS", codes: ["M01O", "M01S"] },
    { name: "Mars Express", agency: "ESA", role: "orbiter, webcam", codes: ["MEX"], data: "https://www.flickr.com/photos/esa_marswebcam/" },
    { name: "ExoMars TGO", agency: "ESA/Roscosmos", role: "trace gases, relay", codes: ["TGO"] },
    { name: "Hope", agency: "UAE", role: "weather orbiter", codes: ["EMM"], data: "https://sdc.emiratesmarsmission.ae/" },
    { name: "ESCAPADE", agency: "NASA", role: "twin probes, cruise", codes: ["ESCB", "ESCG"] },
    { name: "Tianwen-1", agency: "CNSA", role: "orbiter (data via CNSA, not public live)" },
  ],
  Jupiter: [
    { name: "Juno", agency: "NASA", role: "polar orbiter, JunoCam", codes: ["JNO"], data: "https://www.missionjuno.swri.edu/junocam/processing" },
    { name: "Europa Clipper", agency: "NASA", role: "cruise to Jupiter", codes: ["EURC"] },
    { name: "JUICE", agency: "ESA", role: "cruise to Jupiter", codes: ["JUIC"] },
  ],
  Saturn: [{ name: "Cassini (archive)", agency: "NASA/ESA/ASI", role: "orbited 2004–2017", data: "https://pds-imaging.jpl.nasa.gov/volumes/iss.html" }],
  Uranus: [
    { name: "Voyager 2 (archive)", agency: "NASA", role: "1986 flyby", codes: ["VGR2"] },
    { name: "JWST / Hubble", agency: "NASA/ESA", role: "remote observations", codes: ["JWST"] },
  ],
  Neptune: [
    { name: "Voyager 2 (archive)", agency: "NASA", role: "1989 flyby", codes: ["VGR2"] },
    { name: "JWST / Hubble", agency: "NASA/ESA", role: "remote observations", codes: ["JWST"] },
  ],
  Pluto: [{ name: "New Horizons", agency: "NASA", role: "2015 flyby, now in the Kuiper Belt", codes: ["NHPC"], data: "https://pluto.jhuapl.edu/" }],
};

export const BODY_CODES = (body: string) => new Set((WATCHERS[body] ?? []).flatMap((w) => w.codes ?? []));

const C_KM_S = 299_792.458;
const AU_KM = 149_597_870.7;

const duration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 2 : 0)} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
  return `${Math.floor(seconds / 3600)} h ${Math.round((seconds % 3600) / 60)} min`;
};
const rate = (bps: number) => (bps >= 1e6 ? `${(bps / 1e6).toFixed(1)} Mb/s` : bps >= 1e3 ? `${(bps / 1e3).toFixed(1)} kb/s` : `${bps} b/s`);
const utc = (t: string) => t.slice(0, 16).replace("T", " ") + " UTC";

function useIntel(body: string) {
  const [state, setState] = useState<{ body: string; data: Intel | null; failed: boolean }>({ body, data: null, failed: false });
  useEffect(() => {
    let alive = true;
    let retry: number | undefined;
    const load = () =>
      fetch(`/api/body?body=${body}`)
        .then((r) => (r.ok ? (r.json() as Promise<Intel>) : Promise.reject(new Error())))
        .then((data) => alive && setState({ body, data, failed: false }))
        .catch(() => {
          if (!alive) return;
          setState((prev) => ({ ...prev, body, failed: true }));
          retry = window.setTimeout(load, 30000);
        });
    load();
    const id = window.setInterval(load, 15 * 60000);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.clearTimeout(retry);
    };
  }, [body]);
  return state.body === body ? state : { body, data: null, failed: false };
}

/** A set of images: a movie for regular sequences (EPIC), a grid otherwise. Each tile shows taken → received. */
function Frames({ items, movie, onOpen }: { items: Item[]; movie?: boolean; onOpen: (item: Item) => void }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const ordered = useMemo(() => [...items].sort((a, b) => a.t.localeCompare(b.t)), [items]);
  useEffect(() => {
    if (!movie || !playing || ordered.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % ordered.length), 700);
    return () => window.clearInterval(id);
  }, [movie, playing, ordered.length]);
  if (!items.length) return <p className="py-3 text-center font-mono text-[10px] text-slate-600">nothing published for this period</p>;
  if (movie) {
    const item = ordered[Math.min(index, ordered.length - 1)];
    return (
      <div className="relative overflow-hidden rounded bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.src} alt={`${item.by}, ${utc(item.t)}`} className="mx-auto aspect-square w-full max-w-[320px] object-contain" onClick={() => onOpen(item)} />
        {/* Preload the rest of the day quietly. */}
        <div className="hidden" aria-hidden="true">
          {ordered.map((o) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={o.src} src={o.src} alt="" />
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/85 to-black/0 px-2 pb-1 pt-3">
          <button type="button" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying((p) => !p)} className="grid h-5 w-5 place-items-center rounded bg-slate-900/80 text-sky-200">
            {playing ? <Pause size={11} aria-hidden="true" /> : <Play size={11} aria-hidden="true" />}
          </button>
          <input type="range" min={0} max={ordered.length - 1} value={index} aria-label="Frame" onChange={(e) => (setPlaying(false), setIndex(Number(e.target.value)))} className="h-1 min-w-0 flex-1 accent-sky-300" />
          <span className="font-mono text-[9px] text-slate-300">{utc(item.t).slice(11)}</span>
        </div>
      </div>
    );
  }
  // Rover frames come tagged with a camera group: show each group as its own tidy row, in the order the API sent them.
  if (items.some((item) => item.group)) {
    const groups: { id: string; items: Item[] }[] = [];
    for (const item of items) {
      const id = item.group ?? "Other cameras";
      const row = groups.find((g) => g.id === id);
      if (row) row.items.push(item);
      else groups.push({ id, items: [item] });
    }
    return (
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.id}>
            <p className="mb-0.5 flex items-baseline justify-between gap-2 font-mono text-[9px] text-slate-400">
              <span className="truncate uppercase tracking-wider text-sky-200/80">{g.id}</span>
              <span className="shrink-0 text-slate-600">{g.items.length} frame{g.items.length === 1 ? "" : "s"}</span>
            </p>
            <FrameGrid items={g.items} onOpen={onOpen} />
          </div>
        ))}
      </div>
    );
  }
  return <FrameGrid items={items} onOpen={onOpen} />;
}

function FrameGrid({ items, onOpen }: { items: Item[]; onOpen: (item: Item) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {items.map((item, k) => {
        const delay = item.received ? (Date.parse(item.received) - Date.parse(item.t)) / 1000 : null;
        const camera = item.group ? item.title.split(" · ").slice(1).join(" · ") : "";
        return (
          <button key={`${item.src}-${k}`} type="button" onClick={() => onOpen(item)} className="group relative aspect-square overflow-hidden rounded bg-black text-left" title={`${item.by} · ${item.title}\ntaken ${utc(item.t)}${item.received ? `\nreceived ${utc(item.received)}` : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.src} alt={`${item.by} ${item.title}`} className="h-full w-full object-cover transition group-hover:scale-105" />
            <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-1 font-mono text-[8px] text-slate-200">
              {item.by.slice(0, 5)} {camera ? `${camera} ` : ""}{utc(item.t).slice(11, 16)}
              {delay !== null ? ` ⇣${duration(delay).replace(/ \d+ s$/, "")}` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function BodyIntel({ body, links, distanceAu, onClose }: { body: string; links: BodyLink[]; distanceAu: number | null; onClose: () => void }) {
  const { data, failed } = useIntel(body);
  const [period, setPeriod] = useState<"now" | "before">("now");
  const [open, setOpen] = useState<Item | null>(null);
  const [video, setVideo] = useState<Video | null>(null);
  const watchers = WATCHERS[body] ?? [];
  const codes = BODY_CODES(body);
  const live = links.filter((l) => codes.has(l.code));
  const liveCodes = new Set(live.map((l) => l.code));

  const distanceKm = body === "Moon" ? (data?.moon?.now.distance ?? 384_400) : distanceAu !== null ? distanceAu * AU_KM : null;
  const lightTime = distanceKm !== null ? distanceKm / C_KM_S : null;
  const imagery = data?.imagery;
  const shown = imagery ? (period === "now" ? imagery.now : imagery.before) : [];

  // Measured "analysis": what changed between the newest data and a day (or sol) earlier.
  const analysis = useMemo(() => {
    const lines: string[] = [];
    if (!data) return lines;
    const delays = (data.imagery?.now ?? []).filter((i) => i.received).map((i) => (Date.parse(i.received!) - Date.parse(i.t)) / 1000).filter((d) => d > 0);
    if (delays.length) {
      const sorted = [...delays].sort((a, b) => a - b);
      lines.push(`Downlink delay of the newest images: median ${duration(sorted[Math.floor(sorted.length / 2)])}, fastest ${duration(sorted[0])} (light time alone ${lightTime !== null ? duration(lightTime) : "—"}; the rest is relay passes, DSN scheduling and processing).`);
    }
    const newest = data.imagery?.now.map((i) => Date.parse(i.t)).filter(Number.isFinite).sort((a, b) => b - a)[0];
    if (newest) lines.push(`Newest frame taken ${duration((Date.now() - newest) / 1000)} ago.`);
    if (data.moon) {
      const { now, before } = data.moon;
      lines.push(`Phase ${before.phase.toFixed(1)}% → ${now.phase.toFixed(1)}% in 24 h (${now.phase >= before.phase ? "waxing" : "waning"}); distance ${Math.round(before.distance).toLocaleString("en-US")} → ${Math.round(now.distance).toLocaleString("en-US")} km (${now.distance >= before.distance ? "+" : ""}${Math.round(now.distance - before.distance).toLocaleString("en-US")} km); apparent size ${now.diameter.toFixed(0)}″; libration ${now.subearth_lon.toFixed(2)}° lon, ${now.subearth_lat.toFixed(2)}° lat.`);
    }
    const [w0, w1] = data.weather ?? [];
    if (w0 && w1 && w0.min !== "--") {
      const d = (a: string, b: string) => (Number.isFinite(Number(a)) && Number.isFinite(Number(b)) ? `${Number(a) - Number(b) >= 0 ? "+" : ""}${Number(a) - Number(b)}` : "±?");
      lines.push(`Gale crater, sol ${w0.sol} (${w0.date}): air ${w0.min}…${w0.max} °C (${d(w0.max, w1.max)} vs sol ${w1.sol}), pressure ${w0.pressure} Pa (${d(w0.pressure, w1.pressure)}), ground ${w0.ground_min}…${w0.ground_max} °C, UV ${w0.uv}. REMS weather is published weeks after the images.`);
    }
    return lines;
  }, [data, lightTime]);

  return (
    <div className="mt-3 rounded-lg border border-sky-900/70 bg-slate-900/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-sky-300">Intel · {body}</p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-400">
            {body === "Earth" ? "Home planet · EPIC sits 1.5 million km away at L1 (5 s light time)" : distanceKm !== null ? `${distanceKm >= 1e7 ? `${(distanceKm / AU_KM).toFixed(3)} au` : `${Math.round(distanceKm).toLocaleString("en-US")} km`} from Earth · one-way light time ${lightTime !== null ? duration(lightTime) : "—"}` : ""}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="grid h-6 w-6 place-items-center rounded text-slate-400 hover:bg-slate-800 hover:text-white">
          <X size={13} aria-hidden="true" />
        </button>
      </div>

      {/* Signals: what the DSN is receiving from this body's spacecraft right now. */}
      <p className="mt-3 font-mono text-[9px] uppercase tracking-widest text-emerald-300">Signals now · Deep Space Network</p>
      {live.length === 0 ? (
        <p className="mt-1 text-[10px] text-slate-500">No DSN antenna is receiving from a spacecraft at {body} at this moment (checked every 30 s — passes come and go with Earth&apos;s rotation).</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {live.map((l) => (
            <li key={`${l.dish}-${l.code}`} className="grid grid-cols-[1fr_auto] gap-x-2 text-[10px]">
              <span className="truncate text-slate-200">
                {l.name} <span className="text-slate-500">· {l.station} {l.dish}</span>
              </span>
              <span className="font-mono text-emerald-300">{l.band} {l.downRate ? rate(l.downRate) : "carrier"}</span>
              <span className="col-span-2 font-mono text-[9px] text-slate-500">
                received power {l.power !== null ? `${l.power} dBm` : "—"}
                {l.rangeKm ? ` · range ${l.rangeKm >= 1e7 ? `${(l.rangeKm / AU_KM).toFixed(3)} au` : `${Math.round(l.rangeKm).toLocaleString("en-US")} km`} · signal left it ${duration(l.rangeKm / C_KM_S)} ago` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Watchers. */}
      <p className="mt-3 font-mono text-[9px] uppercase tracking-widest text-slate-400">Who watches {body}</p>
      <ul className="mt-1 grid grid-cols-1 gap-x-3 gap-y-0.5 text-[10px] sm:grid-cols-2">
        {watchers.map((w) => {
          const on = (w.codes ?? []).some((c) => liveCodes.has(c));
          return (
            <li key={w.name} className="flex items-baseline gap-1.5">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${on ? "bg-emerald-400" : "bg-slate-700"}`} title={on ? "DSN downlink active now" : "no DSN downlink at this moment"} />
              <span className="truncate text-slate-300">
                {w.data ? (
                  <a href={w.data} rel="noreferrer" className="hover:text-white hover:underline">
                    {w.name}
                  </a>
                ) : (
                  w.name
                )}
                <span className="text-slate-500"> · {w.agency} · {w.role}</span>
              </span>
            </li>
          );
        })}
      </ul>

      {/* Imagery: newest vs one day / sol earlier. */}
      {!data && <p className="mt-3 animate-pulse font-mono text-[10px] text-slate-500">{failed ? "Source unreachable — retrying in 30 s…" : "Pulling the newest downlinked data…"}</p>}
      {imagery && (
        <div className="mt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[9px] uppercase tracking-widest text-sky-300">Returned imagery</p>
            <div className={`flex overflow-hidden rounded border border-slate-700 ${body === "Moon" ? "hidden" : ""}`}>
              {(["now", "before"] as const).map((p) => (
                <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)} className={`px-1.5 py-0.5 font-mono text-[9px] ${period === p ? "bg-sky-300 text-slate-950" : "text-slate-300 hover:text-white"}`}>
                  {p === "now" ? "newest" : body === "Mars" ? "1 sol earlier" : "1 day earlier"}
                </button>
              ))}
            </div>
          </div>
          <p className="mb-1 mt-0.5 font-mono text-[9px] text-slate-500">{body === "Moon" ? "24 h ago (left) against now (right)" : period === "now" ? imagery.nowLabel : imagery.beforeLabel}</p>
          {body === "Moon" ? (
            <div className="grid grid-cols-2 gap-2">
              {[...imagery.before, ...imagery.now].map((item, k) => (
                <button key={item.src} type="button" onClick={() => setOpen(item)} className="rounded bg-black p-1 text-left">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.src} alt={`The Moon ${k ? "now" : "24 h ago"}`} className="aspect-square w-full object-contain" />
                  <p className="font-mono text-[9px] text-slate-400">{k ? "now" : "24 h ago"} · {item.title}</p>
                </button>
              ))}
            </div>
          ) : (
            <Frames key={`${body}-${period}`} items={shown} movie={imagery.movie} onOpen={setOpen} />
          )}
          <p className="mt-1 text-[9px] leading-snug text-slate-500">{imagery.note}</p>
        </div>
      )}

      {open && (
        <div className="mt-2 rounded border border-slate-700 bg-black p-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open.src} alt={`${open.by} ${open.title}`} className="mx-auto max-h-[420px] w-full object-contain" />
          <div className="flex items-center justify-between gap-2 px-1 py-0.5 font-mono text-[9px] text-slate-400">
            <span className="truncate">
              {open.by} · {open.title} · taken {utc(open.t)}
              {open.received ? ` · received ${utc(open.received)} (${duration((Date.parse(open.received) - Date.parse(open.t)) / 1000)} later)` : ""}
            </span>
            <span className="flex shrink-0 gap-2">
              {open.full && (
                <a href={open.full} rel="noreferrer" className="inline-flex items-center gap-0.5 text-sky-300 hover:underline">
                  full <ExternalLink size={9} aria-hidden="true" />
                </a>
              )}
              <button type="button" onClick={() => setOpen(null)} className="text-slate-400 hover:text-white">close</button>
            </span>
          </div>
        </div>
      )}

      {analysis.length > 0 && (
        <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
          <p className="font-mono text-[9px] uppercase tracking-widest text-amber-300">Analysis · newest vs earlier</p>
          <ul className="mt-1 space-y-1 text-[10px] leading-snug text-slate-300">{analysis.map((line) => <li key={line}>{line}</li>)}</ul>
        </div>
      )}

      {data?.weather && data.weather.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full font-mono text-[9px] text-slate-400">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left font-normal">sol</th><th className="font-normal">air °C</th><th className="font-normal">ground °C</th><th className="font-normal">Pa</th><th className="font-normal">sky</th>
              </tr>
            </thead>
            <tbody>
              {data.weather.map((w) => (
                <tr key={w.sol}>
                  <td>{w.sol}</td><td className="text-center">{w.min}…{w.max}</td><td className="text-center">{w.ground_min}…{w.ground_max}</td><td className="text-center">{w.pressure}</td><td className="text-center">{w.opacity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Video: live where it exists (Earth, from the ISS), otherwise NASA's newest released video of the body. */}
      <p className="mt-3 font-mono text-[9px] uppercase tracking-widest text-rose-300">Video</p>
      {body === "Earth" && (
        <div className="mt-1">
          <IssPlayer streamId={ISS_STREAMS[1].id} title="Live HD Earth views from the ISS" />
        </div>
      )}
      {body !== "Earth" && (
        <p className="mt-1 text-[9px] leading-snug text-slate-500">
          No spacecraft streams live video from {body}: deep-space links carry kilobits to a few megabits per second, so missions send still frames, which appear above as they arrive. Below is NASA&apos;s newest released footage.
        </p>
      )}
      {video && (
        <video key={video.mp4} src={video.mp4} poster={video.thumb} controls autoPlay playsInline className="mt-1 w-full rounded bg-black" />
      )}
      <div className="mt-1 grid grid-cols-2 gap-1">
        {(data?.archive.videos ?? []).map((v) => (
          <button key={v.mp4} type="button" onClick={() => setVideo(v)} className={`flex items-center gap-1.5 rounded border p-1 text-left ${video?.mp4 === v.mp4 ? "border-rose-400" : "border-slate-800 hover:border-slate-600"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.thumb} alt="" className="h-9 w-14 shrink-0 rounded object-cover" />
            <span className="line-clamp-2 text-[9px] leading-tight text-slate-300">
              {v.title}
              <span className="block font-mono text-slate-500">{v.t.slice(0, 10)}</span>
            </span>
          </button>
        ))}
      </div>

      {(data?.archive.images.length ?? 0) > 0 && (
        <>
          <p className="mt-3 font-mono text-[9px] uppercase tracking-widest text-slate-400">NASA library · newest releases</p>
          <div className="mt-1 grid grid-cols-4 gap-1">
            {data!.archive.images.map((item) => (
              <a key={item.src} href={item.full} rel="noreferrer" className="group relative aspect-square overflow-hidden rounded bg-black" title={`${item.title} · ${item.t.slice(0, 10)}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.src} alt={item.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-1 font-mono text-[8px] text-slate-300">{item.t.slice(0, 10)}</span>
              </a>
            ))}
          </div>
        </>
      )}
      {data && <p className="mt-2 text-[9px] text-slate-600">Compiled {utc(data.generated)} from NASA/JPL raw-image feeds, Curiosity REMS (CAB), DSCOVR EPIC, NASA SVS, NASA DSN Now and the NASA Image and Video Library.</p>}
    </div>
  );
}
