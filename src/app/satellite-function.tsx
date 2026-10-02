"use client";

import { useEffect, useState } from "react";
import { ISS_STREAMS, IssPlayer, TimeLapse, diskFor } from "./orbit-timelapse";
import type { SatMarker } from "./satellite-model";
import GroundLinks from "./ground-links";
import type { SimClock } from "./sim-clock";

/* What a satellite does, shown from openly published sources only:
   - SatNOGS DB / Network (CC BY-SA): photo, radio transmitters, latest received signal (waterfall + audio)
   - NASA GIBS: imagery from the satellite's own sensor around where it is now (Terra, Aqua, Suomi NPP, NOAA-20/21, Landsat, Sentinel-2)
   - NOAA / NASA GIBS: latest full-disk image from geostationary weather satellites
   - NASA: ISS live video
   - Navigation satellites: visibility computed from their orbit
   - Communication satellites: frequency bands from public filings */

export type FunctionKind = "starlink" | "oneweb" | "kuiper" | "qianfan" | "guowang" | "iridium" | "leo" | "meo" | "geo" | "station" | "weather" | "eo" | "nav" | "science";

type SatnogsSatellite = { name: string; names?: string; image?: string; status?: string; website?: string; countries?: string; operator?: string };
type SatnogsTransmitter = { uuid: string; description: string; alive: boolean; type: string; downlink_low: number | null; uplink_low: number | null; mode: string | null; baud: number | null; status: string; service?: string };
type SatnogsObservation = { id: number; start: string; station_name: string; waterfall: string | null; payload: string | null; station_lat: number; station_lng: number };

const GIBS = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi";

/** Sensor imagery layers in NASA GIBS, by satellite name. */
const IMAGERY: { match: RegExp; layer: string; sensor: string; daysBack: number }[] = [
  { match: /^TERRA$/, layer: "MODIS_Terra_CorrectedReflectance_TrueColor", sensor: "MODIS (Terra)", daysBack: 1 },
  { match: /^AQUA$/, layer: "MODIS_Aqua_CorrectedReflectance_TrueColor", sensor: "MODIS (Aqua)", daysBack: 1 },
  { match: /^SUOMI NPP/, layer: "VIIRS_SNPP_CorrectedReflectance_TrueColor", sensor: "VIIRS (Suomi NPP)", daysBack: 1 },
  { match: /^NOAA 20/, layer: "VIIRS_NOAA20_CorrectedReflectance_TrueColor", sensor: "VIIRS (NOAA-20)", daysBack: 1 },
  { match: /^NOAA 21/, layer: "VIIRS_NOAA21_CorrectedReflectance_TrueColor", sensor: "VIIRS (NOAA-21)", daysBack: 1 },
  { match: /^LANDSAT [89]/, layer: "HLS_L30_Nadir_BRDF_Adjusted_Reflectance", sensor: "OLI (Landsat, HLS product)", daysBack: 6 },
  { match: /^SENTINEL-2/, layer: "HLS_S30_Nadir_BRDF_Adjusted_Reflectance", sensor: "MSI (Sentinel-2, HLS product)", daysBack: 6 },
];

/** Full-disk images published by geostationary weather operators. */
const FULL_DISK: { match: RegExp; src: string; credit: string }[] = [
  { match: /^GOES 19/, src: "https://cdn.star.nesdis.noaa.gov/GOES19/ABI/FD/GEOCOLOR/1808x1808.jpg", credit: "NOAA / NESDIS STAR — GOES-19 ABI GeoColor, full disk" },
  { match: /^GOES 18/, src: "https://cdn.star.nesdis.noaa.gov/GOES18/ABI/FD/GEOCOLOR/1808x1808.jpg", credit: "NOAA / NESDIS STAR — GOES-18 ABI GeoColor, full disk" },
  {
    match: /^HIMAWARI-9/,
    src: `${GIBS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=Himawari_AHI_Band13_Clean_Infrared&CRS=EPSG:4326&BBOX=-70,70,70,180&WIDTH=800&HEIGHT=1018&FORMAT=image/jpeg`,
    credit: "JMA Himawari-9 AHI band 13 (infrared) via NASA GIBS, western half of the disk",
  },
];

/** Frequency use of communication constellations, from operators' public regulatory filings (simplified). */
const BANDS: Partial<Record<FunctionKind, { link: string; band: string }[]>> = {
  starlink: [
    { link: "User downlink / uplink", band: "Ku band (10.7–12.7 / 14.0–14.5 GHz)" },
    { link: "Gateways", band: "Ka band, E band on newer satellites" },
    { link: "Between satellites", band: "Optical (laser) links" },
  ],
  oneweb: [
    { link: "User links", band: "Ku band" },
    { link: "Gateways", band: "Ka band" },
  ],
  kuiper: [{ link: "User and gateway links", band: "Ka band" }],
  qianfan: [{ link: "User and gateway links", band: "Ku / Ka band (ITU filings)" }],
  guowang: [{ link: "User and gateway links", band: "Ku / Ka band (ITU filings)" }],
  iridium: [
    { link: "Phones and terminals", band: "L band (1616–1626.5 MHz)" },
    { link: "Gateways and cross-links", band: "Ka band" },
  ],
  meo: [{ link: "User and gateway beams", band: "Ka band (steerable spot beams)" }],
  geo: [{ link: "Typical transponders", band: "C, Ku and/or Ka band — depends on the satellite" }],
  leo: [{ link: "Varies by system", band: "e.g. Globalstar L/S band, ORBCOMM VHF" }],
};

/** True when the panel can show imagery taken by this satellite itself. */
export const hasEarthImagery = (name: string) => IMAGERY.some((item) => item.match.test(name)) || FULL_DISK.some((item) => item.match.test(name));
export const COMM_KINDS: FunctionKind[] = ["starlink", "oneweb", "kuiper", "qianfan", "guowang", "iridium", "meo", "geo", "leo"];

function useSatnogs(norad: number) {
  const [state, setState] = useState<{ norad: number; sat: SatnogsSatellite | null; tx: SatnogsTransmitter[]; obs: SatnogsObservation[]; heard: SatnogsObservation[]; done: boolean }>({ norad, sat: null, tx: [], obs: [], heard: [], done: false });
  useEffect(() => {
    let alive = true;
    const get = <T,>(kind: string) => fetch(`/api/satnogs?kind=${kind}&norad=${norad}`).then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject())).catch(() => null);
    Promise.all([get<SatnogsSatellite[]>("satellite"), get<SatnogsTransmitter[]>("transmitters"), get<SatnogsObservation[]>("observations")]).then(([sat, tx, obs]) => {
      if (!alive) return;
      setState({
        norad,
        sat: Array.isArray(sat) && sat.length ? sat[0] : null,
        tx: Array.isArray(tx) ? tx.filter((t) => t.status === "active").slice(0, 6) : [],
        obs: Array.isArray(obs) ? obs.filter((o) => o.waterfall) : [],
        heard: Array.isArray(obs) ? obs : [],
        done: true,
      });
    });
    return () => {
      alive = false;
    };
  }, [norad]);
  return state.norad === norad ? state : { norad, sat: null, tx: [], obs: [], heard: [], done: false };
}

const isoDay = (daysBack: number) => new Date(Date.now() - daysBack * 86400000).toISOString().slice(0, 10);
const mhz = (hz: number | null) => (hz ? `${(hz / 1e6).toFixed(3)} MHz` : "—");

function Heading({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-xs uppercase tracking-widest text-emerald-300">{children}</p>;
}

export default function SatelliteFunction({
  name, norad, kind, lat, lon, altKm, visibleCities, totalCities, marker, clock,
}: {
  name: string; norad: number; kind: FunctionKind; lat: number; lon: number; altKm: number; visibleCities: number; totalCities: number;
  /** Lets the 3D time-lapse show this satellite flying over. */
  marker?: SatMarker;
  /** Simulated clock of the satellite layer (real time, ×60, ×600). */
  clock?: SimClock;
}) {
  const satnogs = useSatnogs(norad);
  const imagery = IMAGERY.find((item) => item.match.test(name));
  const disk = FULL_DISK.find((item) => item.match.test(name));
  const isIss = norad === 25544;
  const bands = BANDS[kind];

  // Imagery window: ±8° latitude and ±11° longitude around the sub-satellite point (kept inside the map).
  const box = (() => {
    const south = Math.max(-80, Math.min(64, lat - 8));
    const west = Math.max(-180, Math.min(158, lon - 11));
    return `${south.toFixed(2)},${west.toFixed(2)},${(south + 16).toFixed(2)},${(west + 22).toFixed(2)}`;
  })();
  // Round the box so the image URL changes only every few degrees (keeps it cacheable while the satellite moves).
  const coarse = (value: number) => Math.round(value / 4) * 4;
  const imageryBox = (() => {
    const south = Math.max(-80, Math.min(64, coarse(lat) - 8));
    const west = Math.max(-180, Math.min(158, coarse(lon) - 11));
    return `${south},${west},${south + 16},${west + 22}`;
  })();
  void box;

  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {/* Space-to-ground links: only for satellites with open radio records. */}
      {satnogs.done && satnogs.tx.length > 0 && marker && (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:col-span-full">
          <Heading>Ground stations talking to it</Heading>
          <div className="mt-3">
            <GroundLinks
              marker={marker}
              clock={clock}
              name={name}
              frequency={satnogs.tx[0].downlink_low ? mhz(satnogs.tx[0].downlink_low) : null}
              receptions={satnogs.heard.map((o) => ({ id: o.id, start: o.start, station_name: o.station_name, station_lat: o.station_lat, station_lng: o.station_lng }))}
            />
          </div>
        </section>
      )}

      {isIss && (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <Heading>Live video from the station</Heading>
          <div className="mt-2">
            <IssPlayer streamId={ISS_STREAMS[1].id} title="NASA live video from the International Space Station" />
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            NASA&apos;s official stream; when the crew feed is off, NASA shows a placeholder.{" "}
            <a href="https://www.youtube.com/@NASA/streams" target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline">Open on YouTube</a>
          </p>
        </section>
      )}

      {imagery && (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <Heading>What its sensor sees — {imagery.sensor}</Heading>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${GIBS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=${imagery.layer}&CRS=EPSG:4326&BBOX=${imageryBox}&WIDTH=660&HEIGHT=480&FORMAT=image/jpeg&TIME=${isoDay(imagery.daysBack)}`}
            alt={`${imagery.sensor} imagery around ${lat.toFixed(0)}°, ${lon.toFixed(0)}°`}
            className="mt-2 w-full rounded-md border border-slate-800 bg-slate-900"
           
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Mosaic of this satellite&apos;s own passes on {isoDay(imagery.daysBack)}, around its current ground position. Source: NASA GIBS / EOSDIS.
            {imagery.daysBack > 1 && " Landsat and Sentinel-2 revisit every few days, so the tile may be partly empty."}
          </p>
        </section>
      )}

      {disk && (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <Heading>Latest image from this satellite</Heading>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={disk.src} alt={disk.credit} className="mt-2 w-full rounded-md border border-slate-800 bg-black" />
          <p className="mt-1 text-[11px] text-slate-500">{disk.credit}. Updated every 10–15 minutes.</p>
        </section>
      )}

      {(() => {
        const disk = diskFor(lon);
        const own = (disk.id === "goes-east" && /^GOES 19/.test(name)) || (disk.id === "goes-west" && /^GOES 18/.test(name)) || (disk.id === "himawari" && /^HIMAWARI-9/.test(name));
        return (
          <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <Heading>Last 3 days beneath it</Heading>
            <div className="mt-2">
              <TimeLapse key={disk.id} disk={disk} hours={72} size={480} satellite={marker} />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              {own
                ? `This satellite's own images, one per hour over three days. ${disk.credit}.`
                : `The Earth under this satellite's current longitude over the past three days, seen by ${disk.label}${lon > -5 && lon < 70 ? " (nearest disk — Meteosat imagery is not in NASA GIBS)" : ""}. Not taken by this satellite; the spacecraft drawn over it is its live position.`}
            </p>
          </section>
        );
      })()}

      {kind === "nav" && (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <Heading>Navigation signal coverage</Heading>
          <p className="mt-1 text-sm text-slate-300">
            Above 5° elevation for {visibleCities.toLocaleString("en-US")} of {totalCities.toLocaleString("en-US")} large cities right now. A receiver needs four such satellites at once for a position fix.
          </p>
        </section>
      )}

      {bands && (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <Heading>Radio links (public filings)</Heading>
          <dl className="mt-2 space-y-1 text-xs">
            {bands.map((item) => (
              <div key={item.link} className="flex justify-between gap-3 border-b border-slate-800 pb-1">
                <dt className="text-slate-500">{item.link}</dt>
                <dd className="text-right text-slate-200">{item.band}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* SatNOGS: open community database of satellite radio signals. */}
      {satnogs.done && satnogs.tx.length > 0 && (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <Heading>Transmitters</Heading>
          <ul className="mt-2 space-y-1 text-xs">
            {satnogs.tx.map((t) => (
              <li key={t.uuid} className="flex justify-between gap-3 border-b border-slate-800 pb-1">
                <span className="text-slate-300">{t.description}</span>
                <span className="text-right font-mono text-slate-400">
                  {mhz(t.downlink_low)}{t.mode ? ` · ${t.mode}` : ""}{t.baud ? ` ${t.baud} Bd` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {satnogs.done && satnogs.obs[0] && (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <Heading>Latest signal received on the ground</Heading>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={satnogs.obs[0].waterfall ?? ""} alt="Waterfall plot of the received radio signal" className="mt-2 max-h-72 w-full rounded-md border border-slate-800 bg-black object-cover object-top" />
          <p className="mt-1 text-[11px] text-slate-500">
            Waterfall (frequency vs time) recorded by station {satnogs.obs[0].station_name} on {satnogs.obs[0].start.slice(0, 16).replace("T", " ")} UTC.{" "}
            {satnogs.obs[0].payload && (
              <a href={satnogs.obs[0].payload} target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline">Listen to the recording</a>
            )}{" "}
            · <a href={`https://network.satnogs.org/observations/${satnogs.obs[0].id}/`} target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline">Observation #{satnogs.obs[0].id}</a>
          </p>
        </section>
      )}

      {satnogs.done && satnogs.sat?.image && (
        <section className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
          <Heading>Photo</Heading>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://db-satnogs.freetls.fastly.net/media/${satnogs.sat.image}`} alt={`${satnogs.sat.name}`} className="mt-2 max-h-56 w-full rounded-md border border-slate-800 bg-white object-contain" />
          <p className="mt-1 text-[11px] text-slate-500">
            From the SatNOGS DB entry{satnogs.sat.website ? <> · <a href={satnogs.sat.website} target="_blank" rel="noreferrer" className="text-emerald-300 hover:underline">mission website</a></> : null}.
          </p>
        </section>
      )}

      {!satnogs.done && <p className="text-xs text-slate-500">Looking up open radio records…</p>}
      {satnogs.done && !imagery && !disk && !isIss && !bands && kind !== "nav" && !satnogs.tx.length && !satnogs.obs.length && (
        <p className="text-xs text-slate-500">No openly published payload data found for this satellite.</p>
      )}
      <p className="text-[10px] text-slate-600 md:col-span-full">Coverage computed at {Math.round(altKm).toLocaleString("en-US")} km altitude.</p>
    </div>
  );
}
