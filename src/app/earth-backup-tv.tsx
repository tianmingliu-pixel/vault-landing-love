"use client";

import { useEffect, useRef, useState } from "react";

/* Earth Backup TV: a second, deliberately light Orbit TV that keeps showing the Earth when the NASA ISS streams are
   paused or blocked. It uses plain images only — no WebGL, no video, no third-party player — from public agencies:
   - NOAA GOES-19 (East) and GOES-18 (West): full-disk GeoColor, a new image every 10 minutes (NOAA/NESDIS STAR CDN)
   - JMA Himawari-9: full-disk infrared via NASA GIBS (Asia–Pacific)
   - NASA DSCOVR/EPIC: the whole sunlit Earth from 1.5 million km, about a dozen images a day
   "Auto" follows daylight: it shows the geostationary satellite under which it is closest to local noon.
   Images load only while the panel is on screen, refresh every 10 minutes, and a failed source is skipped. */

type Channel = { id: string; label: string; region: string; centerLon?: number; credit: string; url: (bucket: number) => string | null };

const GIBS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";
const TEN_MIN = 600_000;

const GEO: Channel[] = [
  {
    id: "goes-east",
    label: "GOES-East",
    region: "Americas · Atlantic",
    centerLon: -75.2,
    credit: "NOAA GOES-19 ABI GeoColor · NOAA/NESDIS STAR",
    url: (b) => `https://cdn.star.nesdis.noaa.gov/GOES19/ABI/FD/GEOCOLOR/678x678.jpg?t=${b}`,
  },
  {
    id: "goes-west",
    label: "GOES-West",
    region: "Pacific · western Americas",
    centerLon: -137.2,
    credit: "NOAA GOES-18 ABI GeoColor · NOAA/NESDIS STAR",
    url: (b) => `https://cdn.star.nesdis.noaa.gov/GOES18/ABI/FD/GEOCOLOR/678x678.jpg?t=${b}`,
  },
  {
    id: "himawari",
    label: "Himawari-9",
    region: "Asia · Australia",
    centerLon: 140.7,
    credit: "JMA Himawari-9 AHI infrared · NASA GIBS",
    url: (b) => `${GIBS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=Himawari_AHI_Band13_Clean_Infrared&CRS=EPSG:4326&BBOX=-70,70,70,180&WIDTH=620&HEIGHT=790&FORMAT=image/jpeg&t=${b}`,
  },
];

/** Longitude where it is local noon right now (ignores the equation of time, ±4°). */
const noonLongitude = (now: number) => {
  const d = new Date(now);
  const hours = d.getUTCHours() + d.getUTCMinutes() / 60;
  return ((((12 - hours) * 15 + 540) % 360) + 360) % 360 - 180;
};
const gap = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
const daylightChannel = (now: number) => GEO.reduce((best, c) => (gap(noonLongitude(now), c.centerLon!) < gap(noonLongitude(now), best.centerLon!) ? c : best), GEO[0]);

export default function EarthBackupTV() {
  const boxRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [choice, setChoice] = useState<string>("auto");
  const [bucket, setBucket] = useState(0);
  const [epic, setEpic] = useState<{ src: string; taken: string } | null>(null);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const [shown, setShown] = useState<{ src: string; channel: string; at: number } | null>(null);

  // Only work while the panel is on screen.
  useEffect(() => {
    const node = boxRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "200px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Ten-minute refresh clock (also drives "Auto"), paused while hidden.
  useEffect(() => {
    if (!visible) return;
    const tick = () => setBucket(Math.floor(Date.now() / TEN_MIN));
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [visible]);

  // EPIC needs one small lookup (through our API) for the newest file name.
  useEffect(() => {
    if (!visible || choice !== "epic" || epic) return;
    let live = true;
    fetch("/api/epic")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => live && data?.src && setEpic(data))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [visible, choice, epic]);

  const now = bucket * TEN_MIN;
  const order: Channel[] = choice === "auto" ? [daylightChannel(now), ...GEO.filter((c) => c !== daylightChannel(now))] : choice === "epic" ? [] : [GEO.find((c) => c.id === choice)!, ...GEO.filter((c) => c.id !== choice)];
  const active = order.find((c) => !failed.has(c.id)) ?? null;
  const wanted = choice === "epic" ? (epic ? { src: epic.src, channel: "epic" } : null) : active && bucket ? { src: active.url(bucket)!, channel: active.id } : null;

  // Preload the next image off-screen and swap only once it has arrived: no blank frames, no stutter.
  useEffect(() => {
    if (!visible || !wanted || wanted.src === shown?.src) return;
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => setShown({ ...wanted, at: Date.now() });
    img.onerror = () => setFailed((prev) => new Set(prev).add(wanted.channel));
    img.src = wanted.src;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [visible, wanted?.src]); // eslint-disable-line react-hooks/exhaustive-deps

  // Give failed sources another chance every hour.
  useEffect(() => {
    if (!failed.size) return;
    const id = window.setTimeout(() => setFailed(new Set()), 3_600_000);
    return () => window.clearTimeout(id);
  }, [failed]);

  const current = shown && (shown.channel === "epic" ? null : GEO.find((c) => c.id === shown.channel));
  const credit = shown?.channel === "epic" ? "NASA DSCOVR EPIC · natural colour, whole sunlit Earth from 1.5 million km" : current?.credit;
  const tabs = [{ id: "auto", label: "Auto · daylight" }, ...GEO.map((c) => ({ id: c.id, label: c.label })), { id: "epic", label: "Whole Earth (EPIC)" }];

  return (
    <section ref={boxRef} aria-labelledby="backup-tv-title" className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <p id="backup-tv-title" className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-sky-300">
          <span className="h-2 w-2 rounded-full bg-sky-400" aria-hidden="true" />
          Earth backup TV
        </p>
        <span className="font-mono text-[10px] text-slate-500">no video · images only</span>
      </div>

      <div className="relative mt-3 aspect-square overflow-hidden rounded-md border border-slate-800 bg-black">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={shown.src} src={shown.src} alt={`Earth from ${credit ?? "space"}`} referrerPolicy="no-referrer" className="h-full w-full animate-[fadein_0.6s_ease-out] object-contain" />
        ) : (
          <div className="grid h-full place-items-center text-[11px] text-slate-500">{visible ? "Loading the latest image…" : ""}</div>
        )}
        {shown && (
          <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-slate-300">
            {shown.channel === "epic"
              ? `EPIC · taken ${epic?.taken.slice(0, 16).replace("T", " ")} UTC`
              : `${current?.label} · ${current?.region} · refreshed ${new Date(shown.at).toISOString().slice(11, 16)} UTC`}
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={choice === t.id}
            onClick={() => setChoice(t.id)}
            className={`rounded border px-1.5 py-0.5 text-[10px] ${choice === t.id ? "border-sky-300 text-sky-200" : "border-slate-700 text-slate-400 hover:text-slate-200"} ${failed.has(t.id) ? "opacity-50" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Keeps the Earth on screen when the ISS stream pauses. Geostationary images update every 10 minutes; Auto shows the satellite nearest local noon, and an unavailable source is skipped automatically.
        {credit ? ` ${credit}.` : ""}
      </p>
    </section>
  );
}
