"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { ZoomControls, useFullscreen } from "./network-globe";

/* The Sun, live: NASA SDO / SOHO imagery and NOAA space-weather data, plus what it means for satellites. */

type Point = { t: string; v: number };
type Plasma = { source: string | null; speed: Point[]; density: Point[] };
type Mag = { bz: Point[]; bt: Point[] };
type Alert = { id: string; t: string; headline: string };
type Probabilities = Record<string, number | string>;
type F107 = { time_tag: string; flux: number; ninety_day_mean: number | null };
type Sunspots = { "time-tag": string; ssn: number; "f10.7": number }[];
type Scales = Record<string, { R: { Scale: string | null }; S: { Scale: string | null }; G: { Scale: string | null } }>;

export const SUN_VIEWS = [
  { id: "SUVI195", label: "Corona 195 Å", refreshMin: 4, note: "NOAA GOES-19 SUVI — the hot corona; dark patches are coronal holes, sources of fast solar wind. A new image every 4 minutes." },
  { id: "SUVI304", label: "Chromosphere 304 Å", refreshMin: 4, note: "NOAA GOES-19 SUVI — the chromosphere and prominences lifting off the limb." },
  { id: "SUVI131", label: "Flares 131 Å", refreshMin: 4, note: "NOAA GOES-19 SUVI — the hottest plasma; flares light up here first." },
  { id: "HMIMAG", label: "Magnetic field", refreshMin: 10, note: "NASA SDO / HMI magnetogram via Helioviewer — white and black are opposite polarities of the photospheric field; active regions are where they crowd together." },
  { id: "HMIINT", label: "Sunspots", refreshMin: 10, note: "NASA SDO / HMI continuum via Helioviewer — visible light; sunspots sit on the strongest magnetic field." },
  { id: "AIA193", label: "SDO AIA 193 Å", refreshMin: 10, note: "NASA SDO / AIA via Helioviewer — highest-resolution view of the corona." },
  { id: "C3", label: "Coronagraph", refreshMin: 10, note: "ESA/NASA SOHO / LASCO C3 via NOAA — the Sun is blocked out; coronal mass ejections show as expanding clouds." },
] as const;
export type SunViewId = (typeof SUN_VIEWS)[number]["id"];

/* Shared selection: the 3D Sun in the solar-system panel shows the same channel. */
let currentView: SunViewId = "SUVI195";
const listeners = new Set<() => void>();
export function setSunView(id: SunViewId) {
  currentView = id;
  listeners.forEach((listener) => listener());
}
export function useSunView() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => currentView,
    () => currentView,
  );
}

/** Loads one live image and the time it was observed. */
export function useSunImage(view: SunViewId) {
  const [state, setState] = useState<{ view: SunViewId; url: string | null; observed: string | null }>({ view, url: null, observed: null });
  const refreshMin = SUN_VIEWS.find((v) => v.id === view)?.refreshMin ?? 10;
  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    let retry: number | undefined;
    const load = (): Promise<void> =>
      fetch(`/api/sun?view=${view}&t=${Math.floor(Date.now() / (refreshMin * 60000))}`)
        .then(async (r) => {
          if (!r.ok) throw new Error();
          const blob = await r.blob();
          if (!alive) return;
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          objectUrl = URL.createObjectURL(blob);
          setState({ view, url: objectUrl, observed: r.headers.get("X-Observed") || null });
        })
        // Keep showing the last good image and try again in 30 s instead of waiting for the next refresh.
        .catch(() => {
          if (alive) retry = window.setTimeout(() => void load(), 30000);
        });
    load();
    const id = window.setInterval(load, refreshMin * 60000);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.clearTimeout(retry);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [view, refreshMin]);
  return state.view === view ? state : { view, url: null, observed: null };
}

/** "observed 7 min ago" — and the light from that moment left the Sun 8.3 minutes before that. */
export function ageText(observed: string | null, now: number) {
  if (!observed) return "observation time unknown";
  const minutes = Math.max(0, Math.round((now - Date.parse(observed)) / 60000));
  const age = minutes < 90 ? `${minutes} min ago` : minutes < 2880 ? `${(minutes / 60).toFixed(1)} h ago` : `${Math.round(minutes / 1440)} d ago`;
  return `observed ${minutes >= 1440 ? observed.slice(5, 10) + " " : ""}${observed.slice(11, 16)} UTC · ${age}`;
}

const flareClass = (flux: number) => {
  const letters = [["X", 1e-4], ["M", 1e-5], ["C", 1e-6], ["B", 1e-7], ["A", 1e-8]] as const;
  for (const [letter, base] of letters) if (flux >= base) return `${letter}${(flux / base).toFixed(1)}`;
  return "A0.0";
};

type Weather = {
  xray: Point[]; kp: Point[]; plasma: Plasma | null; mag: Mag | null; scales: Scales | null;
  protons: Point[]; daily: Daily[]; alerts: Alert[]; probabilities: Probabilities | null; f107: F107 | null; sunspots: Sunspots;
  updated: number | null; failed: string[];
};
type Daily = { t: string; f107: number; ssn: number; c: number; m: number; x: number };
const KINDS = ["xray", "kp", "plasma", "mag", "scales", "protons", "daily", "alerts", "probabilities", "f107", "sunspots"] as const;

function useSpaceWeather() {
  const [state, setState] = useState<Weather>({ xray: [], kp: [], plasma: null, mag: null, scales: null, protons: [], daily: [], alerts: [], probabilities: null, f107: null, sunspots: [], updated: null, failed: [] });
  useEffect(() => {
    let alive = true;
    let retry: number | undefined;
    const get = (kind: string) => fetch(`/api/space-weather?kind=${kind}`).then((r) => (r.ok ? (r.json() as Promise<unknown>) : null)).catch(() => null);
    const load = () =>
      Promise.all(KINDS.map(get)).then((results) => {
        if (!alive) return;
        const by = Object.fromEntries(KINDS.map((kind, i) => [kind, results[i]])) as Record<(typeof KINDS)[number], unknown>;
        const list = <T,>(value: unknown) => (Array.isArray(value) ? (value as T[]) : null);
        const failed = KINDS.filter((kind) => by[kind] == null);
        // A product that fails keeps its previous value, so one slow feed never blanks the panel.
        setState((prev) => ({
          xray: list<Point>(by.xray) ?? prev.xray,
          kp: list<Point>(by.kp) ?? prev.kp,
          plasma: (by.plasma as Plasma | null)?.speed ? (by.plasma as Plasma) : prev.plasma,
          mag: (by.mag as Mag | null)?.bz ? (by.mag as Mag) : prev.mag,
          scales: (by.scales as Scales | null) ?? prev.scales,
          protons: list<Point>(by.protons) ?? prev.protons,
          alerts: list<Alert>(by.alerts) ?? prev.alerts,
          probabilities: (by.probabilities as Probabilities | null) ?? prev.probabilities,
          f107: (by.f107 as F107 | null) ?? prev.f107,
          sunspots: list<Sunspots[number]>(by.sunspots) ?? prev.sunspots,
          daily: list<Daily>(by.daily) ?? prev.daily,
          updated: failed.length < KINDS.length ? Date.now() : prev.updated,
          failed,
        }));
        window.clearTimeout(retry);
        if (failed.length) retry = window.setTimeout(load, 60000);
      });
    load();
    const id = window.setInterval(load, 5 * 60000);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.clearTimeout(retry);
    };
  }, []);
  return state;
}

/** The Sun image with the same + / − / reset / full-screen controls as the satellite globe; drag to pan, wheel to zoom. */
function SunImage({ url, alt, badge, movie }: { url: string | null; alt: string; badge: string; movie?: ReactNode }) {
  const { ref, full, toggle } = useFullscreen();
  const [zoom, setZoom] = useState({ s: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const scaleBy = (factor: number) =>
    setZoom((z) => {
      const s = Math.min(8, Math.max(1, z.s * factor));
      return s === 1 ? { s, x: 0, y: 0 } : { s, x: (z.x * s) / z.s, y: (z.y * s) / z.s };
    });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      scaleBy(event.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ref]);
  return (
    <div
      ref={ref}
      className={`relative mx-auto mt-3 overflow-hidden bg-black ${full ? "h-screen w-screen" : "aspect-square rounded-lg"} ${zoom.s > 1 ? "cursor-grab active:cursor-grabbing" : ""}`}
      onPointerDown={(event) => {
        if (zoom.s === 1) return;
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY, ox: zoom.x, oy: zoom.y };
      }}
      onPointerMove={(event) => {
        const d = drag.current;
        if (d) setZoom((z) => ({ ...z, x: d.ox + event.clientX - d.x, y: d.oy + event.clientY - d.y }));
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={() => scaleBy(2)}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          draggable={false}
          className="h-full w-full select-none object-contain"
          style={{ transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.s})`, transition: "transform 90ms ease-out" }}
        />
      )}
      {!url && <div className="grid h-full place-items-center font-mono text-[10px] text-slate-500">Fetching the latest image…</div>}
      {movie}
      <ZoomControls onZoomIn={() => scaleBy(1.6)} onZoomOut={() => scaleBy(1 / 1.6)} onReset={() => setZoom({ s: 1, x: 0, y: 0 })} full={full} onFullscreen={toggle} />
      <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-amber-200">
        {badge}
        {zoom.s > 1 ? ` · ×${zoom.s.toFixed(1)}` : ""}
      </span>
    </div>
  );
}

const HOUR = 3_600_000;

/**
 * One series over the last 30 days (solid), against its own 30-day average (dashed), with day ticks.
 * Hover anywhere for the value at that moment. Where NOAA keeps less than 30 days, the line starts later.
 */
function TrendChart({ points, now, color, log = false, step = false, format, height = 64, zero = false, days = 30 }: {
  points: Point[]; now: number; color: string; log?: boolean; step?: boolean; format: (v: number) => string; height?: number; zero?: boolean; days?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 300;
  const span = days * 24 * HOUR;
  const start = now - span;
  const series = points
    .map((p) => ({ ms: Date.parse(p.t.endsWith("Z") ? p.t : p.t + "Z"), v: p.v }))
    .filter((p) => Number.isFinite(p.ms) && Number.isFinite(p.v) && p.ms > start && (!log || p.v > 0));
  if (series.length < 2) return <div style={{ height }} className="grid place-items-center font-mono text-[9px] text-slate-600">waiting for data…</div>;
  const y = (v: number) => (log ? Math.log10(v) : v);
  const values = series.map((p) => y(p.v));
  let lo = Math.min(...values, ...(zero ? [0] : []));
  let hi = Math.max(...values, ...(zero ? [0] : []));
  if (hi - lo < 1e-9) [lo, hi] = [lo - 1, hi + 1];
  const pad = (hi - lo) * 0.08;
  const X = (ms: number) => ((ms - start) / span) * W;
  const Y = (v: number) => height - 12 - ((y(v) - lo + pad) / (hi - lo + 2 * pad)) * (height - 16);
  const gap = step ? 4 * HOUR : 3 * HOUR;
  const d = series
    .map((p, i) => {
      const cmd = i === 0 || p.ms - series[i - 1].ms > gap ? "M" : "L";
      if (step && cmd === "L") return `H${X(p.ms).toFixed(1)}V${Y(p.v).toFixed(1)}`;
      return `${cmd}${X(p.ms).toFixed(1)},${Y(p.v).toFixed(1)}`;
    })
    .join("");
  // Average in the plotted space (geometric mean for log series), so the dashed line sits where the eye expects it.
  const meanY = values.reduce((a, b) => a + b, 0) / values.length;
  const mean = log ? 10 ** meanY : meanY;
  const hoverMs = hover === null ? null : start + (hover / W) * span;
  let at = series.at(-1)!;
  if (hoverMs !== null) for (const p of series) if (Math.abs(p.ms - hoverMs) < Math.abs(at.ms - hoverMs)) at = p;
  const covered = (series.at(-1)!.ms - series[0].ms) / (24 * HOUR);
  const ticks = days >= 30 ? [30, 20, 10] : [7, 5, 3, 1];
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        className="w-full touch-none"
        style={{ height }}
        preserveAspectRatio="none"
        onPointerMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          setHover(((event.clientX - box.left) / box.width) * W);
        }}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Last ${days} days; now ${format(series.at(-1)!.v)}, ${days}-day average ${format(mean)}`}
      >
        {ticks.map((t) => (
          <line key={t} x1={X(now - t * 24 * HOUR)} x2={X(now - t * 24 * HOUR)} y1={0} y2={height - 10} stroke="#1e293b" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {zero && lo < 0 && hi > 0 && <line x1={0} x2={W} y1={Y(0)} y2={Y(0)} stroke="#334155" vectorEffect="non-scaling-stroke" />}
        <line x1={X(series[0].ms)} x2={W} y1={Y(mean)} y2={Y(mean)} stroke={color} strokeOpacity="0.5" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        <path d={d} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
        {hover !== null && <line x1={hover} x2={hover} y1={0} y2={height - 10} stroke="#94a3b8" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        {ticks.map((t) => (
          <text key={t} x={X(now - t * 24 * HOUR) + 2} y={height - 1} fontSize="7" fill="#64748b" style={{ fontFamily: "monospace" }}>−{t} d</text>
        ))}
        <text x={W - 2} y={height - 1} fontSize="7" fill="#64748b" textAnchor="end" style={{ fontFamily: "monospace" }}>now</text>
      </svg>
      <p className="flex justify-between font-mono text-[9px] text-slate-500">
        <span>
          <span style={{ color }}>━</span> {hoverMs === null ? "now" : new Date(at.ms).toISOString().slice(5, 16).replace("T", " ") + " UTC"} {format(at.v)}
        </span>
        <span>
          <span style={{ color, opacity: 0.6 }}>┅</span> {Math.min(days, Math.round(covered))}-day avg {format(mean)}
        </span>
      </p>
    </div>
  );
}

/** Flares per day (C, M, X) over 30 days, from NOAA's daily solar data. */
function FlareBars({ daily }: { daily: Daily[] }) {
  if (!daily.length) return null;
  const max = Math.max(1, ...daily.map((d) => d.c + d.m + d.x));
  return (
    <div>
      <div className="flex h-10 items-end gap-px" aria-label="Flares per day, last 30 days">
        {daily.map((d) => {
          const total = d.c + d.m + d.x;
          return (
            <div key={d.t} className="flex flex-1 flex-col justify-end" style={{ height: "100%" }} title={`${d.t.slice(0, 10)} · C${d.c} M${d.m} X${d.x} · F10.7 ${d.f107} · SSN ${d.ssn}`}>
              {d.x > 0 && <div style={{ height: `${(d.x / max) * 100}%`, background: "#ef4444" }} />}
              {d.m > 0 && <div style={{ height: `${(d.m / max) * 100}%`, background: "#fb923c" }} />}
              {d.c > 0 && <div style={{ height: `${(d.c / max) * 100}%`, background: "#facc15" }} />}
              {total === 0 && <div className="h-px bg-slate-700" />}
            </div>
          );
        })}
      </div>
      <p className="flex justify-between font-mono text-[9px] text-slate-500">
        <span>{daily[0].t.slice(5, 10)}</span>
        <span>
          <span className="text-yellow-300">■</span> C {daily.reduce((a, d) => a + d.c, 0)} · <span className="text-orange-400">■</span> M {daily.reduce((a, d) => a + d.m, 0)} · <span className="text-red-500">■</span> X {daily.reduce((a, d) => a + d.x, 0)} in 30 d
        </span>
        <span>{daily.at(-1)!.t.slice(5, 10)}</span>
      </p>
    </div>
  );
}

/** The frames behind one view (see /api/sun/frames), refreshed as new images arrive. */
function useSunFrames(view: SunViewId, span: "3h" | "30d", refreshMin: number) {
  const [state, setState] = useState<{ key: string; frames: { t: string; src: string }[] }>({ key: "", frames: [] });
  const key = `${view}-${span}`;
  useEffect(() => {
    let alive = true;
    let retry: number | undefined;
    const load = () =>
      fetch(`/api/sun/frames?view=${view}&span=${span}&t=${Math.floor(Date.now() / (refreshMin * 60000))}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
        .then((body: { frames: { t: string; src: string }[] }) => {
          if (alive && body.frames?.length) setState({ key, frames: body.frames });
        })
        .catch(() => {
          if (alive) retry = window.setTimeout(load, 30000);
        });
    load();
    const id = window.setInterval(load, refreshMin * 60000);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.clearTimeout(retry);
    };
  }, [view, span, refreshMin, key]);
  return state.key === key ? state.frames : [];
}

/** `compact`: the image, channels and today's NOAA scales only (for the home page); the full panel adds 30 days of data. */
export default function SunPanel({ compact = false }: { compact?: boolean } = {}) {
  const viewId = useSunView();
  const view = SUN_VIEWS.find((v) => v.id === viewId) ?? SUN_VIEWS[0];
  const sun = useSunImage(view.id);
  const [span, setSpan] = useState<"3h" | "30d">("30d");
  const frames = useSunFrames(view.id, span, view.refreshMin);
  const [playing, setPlaying] = useState(true);
  const [frameIndex, setFrameIndex] = useState<number | null>(null);
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());

  // Preload every frame (small WebP, cached for good) and play only through the ones that have arrived.
  useEffect(() => {
    let alive = true;
    const images = frames.map((frame) => {
      const image = new Image();
      image.onload = () => alive && setLoaded((prev) => (prev.has(frame.src) ? prev : new Set(prev).add(frame.src)));
      image.src = frame.src;
      return image;
    });
    return () => {
      alive = false;
      images.forEach((image) => (image.onload = null));
    };
  }, [frames]);
  const ready = frames.filter((frame) => loaded.has(frame.src));
  const shown = ready.length ? ready[Math.min(frameIndex ?? ready.length - 1, ready.length - 1)] : null;
  useEffect(() => {
    if (!playing || ready.length < 2) return;
    let hold = 0;
    const id = window.setInterval(() => {
      setFrameIndex((current) => {
        const at = current ?? ready.length - 1;
        if (at >= ready.length - 1) {
          // Rest on the newest frame for a moment before looping, so "now" is always readable.
          if (hold++ < 8) return at;
          hold = 0;
          return 0;
        }
        return at + 1;
      });
    }, span === "3h" ? 140 : 320);
    return () => window.clearInterval(id);
  }, [playing, ready.length, span]);
  useEffect(() => setFrameIndex(null), [view.id, span]);
  const [now, setNow] = useState(() => Date.now());
  const weather = useSpaceWeather();

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, []);

  const latestX = weather.xray.at(-1)?.v ?? null;
  const peakX = Math.max(0, ...weather.xray.map((p) => p.v));
  const latestKp = weather.kp.at(-1)?.v ?? null;
  const speed = weather.plasma?.speed.at(-1)?.v ?? null;
  const density = weather.plasma?.density.at(-1)?.v ?? null;
  const bz = weather.mag?.bz.at(-1)?.v ?? null;
  const bt = weather.mag?.bt.at(-1)?.v ?? null;
  const today = weather.scales?.["0"];
  const latestP = weather.protons.at(-1)?.v ?? null;
  const prob = weather.probabilities;
  const ssn = weather.sunspots.at(-1);
  const stale = weather.updated !== null && now - weather.updated > 15 * 60000;

  const impact = useMemo(() => {
    const lines: string[] = [];
    if (latestKp !== null) {
      if (latestKp >= 7) lines.push("Severe geomagnetic storm: upper-atmosphere drag rises sharply — LEO satellites lose altitude, as 38 new Starlinks did in February 2022.");
      else if (latestKp >= 5) lines.push("Geomagnetic storm: more drag on LEO satellites and larger GNSS positioning errors; aurora at high latitudes.");
      else lines.push("Geomagnetic field quiet to unsettled: normal drag and GNSS accuracy for the satellites below.");
    }
    if (latestX !== null) {
      if (latestX >= 1e-5) lines.push("M/X-class flare in progress: HF radio blackouts on the sunlit side of Earth.");
      else lines.push("No major flare: HF radio on the day side is unaffected.");
    }
    if (latestP !== null && latestP >= 10) lines.push("Solar radiation storm (≥10 MeV protons above 10 pfu): single-event upsets in satellite electronics and polar HF absorption.");
    if (bz !== null && bz < -10) lines.push("Interplanetary field points strongly south (Bz < −10 nT): the solar wind couples into the magnetosphere; storms can build within hours.");
    return lines;
  }, [latestKp, latestX, latestP, bz]);

  const kpColor = (kp: number) => (kp >= 7 ? "#f87171" : kp >= 5 ? "#fb923c" : kp >= 4 ? "#facc15" : "#34d399");

  return (
    <section aria-labelledby="sun-title" className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-center justify-between">
        <p id="sun-title" className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-amber-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" aria-hidden="true" />
          The Sun · live
        </p>
        <span className={`font-mono text-[10px] ${weather.failed.length || stale ? "text-orange-300" : "text-slate-500"}`} title={weather.failed.length ? `Unreachable now: ${weather.failed.join(", ")} — showing last good values, retrying every minute` : undefined}>
          {weather.updated ? `data ${new Date(weather.updated).toISOString().slice(11, 16)} UTC` : "loading…"}
          {weather.failed.length ? ` · ${weather.failed.length} feed${weather.failed.length > 1 ? "s" : ""} retrying` : ""}
        </span>
      </div>

      <SunImage
        url={shown?.src ?? sun.url}
        alt={`${view.label}, ${ageText(shown?.t ?? sun.observed, now)}`}
        badge={`${shown && shown !== ready.at(-1) ? "▶ " : ""}${span === "30d" && shown ? (shown.src.includes("LASCOC3") ? "SOHO LASCO C3 · daily · " : shown.src.includes("k=AIA") ? `SDO AIA ${shown.src.match(/k=AIA(\d+)/)?.[1]} Å · daily · ` : "SDO HMI · daily · ") : ""}${ageText(shown?.t ?? sun.observed, now)}`}
        movie={
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-center gap-2 bg-gradient-to-t from-black/85 to-black/0 px-2 pb-1.5 pt-4" onPointerDown={(event) => event.stopPropagation()}>
            <button
              type="button"
              aria-label={playing ? "Pause the Sun movie" : "Play the Sun movie"}
              onClick={() => setPlaying((p) => !p)}
              className="grid h-6 w-6 shrink-0 place-items-center rounded bg-slate-900/80 text-amber-200 hover:bg-slate-800"
            >
              {playing ? <Pause size={12} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(0, ready.length - 1)}
              value={Math.min(frameIndex ?? ready.length - 1, Math.max(0, ready.length - 1))}
              onChange={(event) => {
                setPlaying(false);
                setFrameIndex(Number(event.target.value));
              }}
              aria-label="Frame"
              className="h-1 min-w-0 flex-1 accent-amber-300"
            />
            <span className="shrink-0 font-mono text-[9px] text-slate-300">
              {ready.length < frames.length ? `${ready.length}/${frames.length}` : `${frames.length} fr`}
            </span>
            <div className="flex shrink-0 overflow-hidden rounded border border-slate-700" aria-label="Movie span">
              {(["3h", "30d"] as const).map((h) => (
                <button key={h} type="button" aria-pressed={span === h} onClick={() => setSpan(h)} className={`px-1.5 font-mono text-[9px] ${span === h ? "bg-amber-300 text-slate-950" : "text-slate-300 hover:text-white"}`}>
                  {h === "3h" ? "3 h" : "30 d"}
                </button>
              ))}
            </div>
          </div>
        }
      />
      <div className="mt-2 flex flex-wrap gap-1">
        {SUN_VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={v.id === view.id}
            onClick={() => setSunView(v.id)}
            className={`rounded border px-1.5 py-0.5 text-[10px] ${v.id === view.id ? "border-amber-300 text-amber-200" : "border-slate-700 text-slate-400 hover:text-slate-200"}`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <p className="mt-1 text-[10px] leading-snug text-slate-500">{view.note} Light from the Sun takes 8.3 min to reach Earth; the rest of the delay is the ground processing of each image.</p>

      {today && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {(
            [
              ["R", "Radio blackout", today.R.Scale],
              ["S", "Radiation storm", today.S.Scale],
              ["G", "Geomagnetic storm", today.G.Scale],
            ] as const
          ).map(([letter, label, scale]) => (
            <div key={letter} className="rounded border border-slate-800 py-1.5">
              <p className={`font-mono text-sm font-semibold ${Number(scale) > 0 ? "text-orange-300" : "text-emerald-300"}`}>{letter}{scale ?? "0"}</p>
              <p className="text-[9px] text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      {compact ? (
        <a href="/work/network-concept#orbit-title" className="mt-3 block text-right text-xs font-medium text-amber-300 hover:text-amber-200">30 days of solar data, flares and solar wind &rarr;</a>
      ) : (
        <>
      <p className="mt-4 font-mono text-[9px] uppercase tracking-widest text-slate-500">Last 30 days (solid) against the 30-day average (dashed) · hover for any moment</p>
      <div className="mt-2">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-slate-400">Flares per day · C / M / X</span>
          <span className="font-mono text-slate-200">{latestX !== null ? flareClass(latestX) : "—"} <span className="text-slate-500">now</span></span>
        </div>
        <FlareBars daily={weather.daily} />
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-slate-400">X-ray flux · GOES 0.1–0.8 nm · hourly peak</span>
          <span className="font-mono text-slate-500">7 d peak {peakX ? flareClass(peakX) : "—"}</span>
        </div>
        <TrendChart points={weather.xray} now={now} color="#fbbf24" log format={flareClass} days={7} />
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-slate-400">Protons ≥10 MeV · hourly peak</span>
          <span className={`font-mono ${latestP !== null && latestP >= 10 ? "text-orange-300" : "text-slate-200"}`}>{latestP !== null ? `${latestP < 1 ? latestP.toFixed(2) : latestP.toFixed(1)} pfu` : "—"}</span>
        </div>
        <TrendChart points={weather.protons} now={now} color="#f472b6" log format={(v) => `${v < 1 ? v.toFixed(2) : v.toFixed(1)} pfu`} days={7} />
        <p className="font-mono text-[9px] text-slate-600">NOAA keeps 7 days of GOES X-ray and proton data online, so these two span a week; the flare counts above cover the full 30 days.</p>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-slate-400">Kp index · 3-hourly</span>
          <span className="font-mono" style={{ color: latestKp !== null ? kpColor(latestKp) : undefined }}>{latestKp?.toFixed(1) ?? "—"}</span>
        </div>
        <TrendChart points={weather.kp} now={now} color={latestKp !== null ? kpColor(latestKp) : "#34d399"} step zero format={(v) => `Kp ${v.toFixed(2)}`} height={52} />
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-slate-400">Solar wind speed · ACE at L1, hourly</span>
          <span className="font-mono text-slate-200">{speed !== null ? `${Math.round(speed)} km/s` : "—"}</span>
        </div>
        <TrendChart points={weather.plasma?.speed ?? []} now={now} color="#38bdf8" format={(v) => `${Math.round(v)} km/s`} />
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-slate-400">IMF Bz (south = negative)</span>
          <span className={`font-mono ${bz !== null && bz < -10 ? "text-orange-300" : "text-slate-200"}`}>{bz !== null ? `${bz.toFixed(1)} nT` : "—"}</span>
        </div>
        <TrendChart points={weather.mag?.bz ?? []} now={now} color="#a78bfa" zero format={(v) => `${v.toFixed(1)} nT`} height={52} />
        <p className="font-mono text-[10px] text-slate-500">density {density?.toFixed(1) ?? "—"} p/cm³ · Bt {bt?.toFixed(1) ?? "—"} nT</p>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-slate-400">F10.7 radio flux · daily</span>
          <span className="font-mono text-slate-200">{weather.daily.at(-1)?.f107 ?? "—"} sfu</span>
        </div>
        <TrendChart points={weather.daily.map((d) => ({ t: d.t, v: d.f107 }))} now={now} color="#34d399" format={(v) => `${Math.round(v)} sfu`} height={48} />
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-slate-400">Sunspot number · daily</span>
          <span className="font-mono text-slate-200">{weather.daily.at(-1)?.ssn ?? "—"}</span>
        </div>
        <TrendChart points={weather.daily.map((d) => ({ t: d.t, v: d.ssn }))} now={now} color="#e2e8f0" zero format={(v) => `${Math.round(v)}`} height={48} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded border border-slate-800 py-1.5">
          <p className="font-mono text-sm text-slate-200">{weather.f107 ? Math.round(weather.f107.flux) : "—"}</p>
          <p className="text-[9px] text-slate-500">F10.7 sfu{weather.f107?.ninety_day_mean ? ` · 90 d ${weather.f107.ninety_day_mean}` : ""}</p>
        </div>
        <div className="rounded border border-slate-800 py-1.5">
          <p className="font-mono text-sm text-slate-200">{ssn ? ssn.ssn.toFixed(0) : "—"}</p>
          <p className="text-[9px] text-slate-500">Sunspot no. {ssn ? ssn["time-tag"] : ""}</p>
        </div>
        <div className="rounded border border-slate-800 py-1.5">
          <p className="font-mono text-sm text-slate-200">{prob ? `${prob.m_class_1_day}% / ${prob.x_class_1_day}%` : "—"}</p>
          <p className="text-[9px] text-slate-500">M / X flare · 24 h</p>
        </div>
      </div>

      {weather.alerts.length > 0 && (
        <details className="mt-3 rounded border border-slate-800 bg-slate-900/40 p-2">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-slate-400">NOAA alerts &amp; warnings · {weather.alerts.length} latest</summary>
          <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto text-[10px] leading-snug text-slate-300">
            {weather.alerts.map((alert) => (
              <li key={`${alert.id}-${alert.t}`}>
                <span className="font-mono text-slate-500">{alert.t.slice(5, 16)} </span>
                {alert.headline}
              </li>
            ))}
          </ul>
        </details>
      )}

      {impact.length > 0 && (
        <div className="mt-4 rounded border border-slate-800 bg-slate-900/60 p-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-300">For the satellites on this page</p>
          <ul className="mt-1 space-y-1 text-[11px] leading-snug text-slate-300">
            {impact.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </div>
      )}
      <p className="mt-2 text-[10px] text-slate-600">Data: NOAA GOES-19 SUVI, NASA SDO via Helioviewer, ESA/NASA SOHO, NOAA SWPC (GOES X-ray and protons, planetary Kp, real-time solar wind at L1, F10.7, sunspot number, flare probabilities, alerts).</p>
        </>
      )}
    </section>
  );
}
