"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ZoomControls, clamp, useFullscreen, useReducedMotion } from "./network-globe";
import { minRttMs } from "./internet-atlas";
import dynamic from "next/dynamic";
import type { Facility } from "./land-globe";
import type { GeoPoint } from "./geo-map";

// MapLibre needs the browser (WebGL, window), so the street map loads client-side only.
const GeoMap = dynamic(() => import("./geo-map"), {
  ssr: false,
  loading: () => <div className="grid h-[520px] place-items-center rounded-xl border border-slate-800 font-mono text-xs text-slate-500">Loading street map…</div>,
});
const CITY_ZOOM = 10.5;

/* ---------- data: PeeringDB facilities grouped into metros (30 km), per country ---------- */

type City = [name: string, lat: number, lon: number, facilities: number, networks: number, ixps: number, approxFacilities?: number, cableLandings?: number, backbonePoint?: number];

/** Node kind: a data-centre metro, an exchange with no listed data centre, or a submarine-cable landing station only. */
function cityKind(city: City) {
  if (city[3] > 0) return "metro" as const;
  return city[5] > 0 ? ("exchange" as const) : ("landing" as const);
}
const KIND_FILL = { metro: "#d1fae5", exchange: "#c4b5fd", landing: "#67e8f9" };
const cityScore = (city: City) => city[4] * 1000 + city[3] * 10 + city[5] * 5 + (city[7] ?? 0);
/** kind 0 = measured (shared networks, PeeringDB) · 1 = modelled backhaul (spanning tree) · 2 = modelled national backbone (China)
 *  · 3 = traced: a carrier's routers seen in both cities on consecutive traceroute hops (RIPE Atlas) */
type CityLink = [from: number, to: number, shared: number, km: number, kind?: number, carrier?: number, observations?: number];
/** Carrier colours by rank within a country (China: Telecom, Unicom, Mobile, CERNET). */
const CARRIER_COLORS = ["#60a5fa", "#f87171", "#4ade80", "#c084fc", "#fb923c", "#22d3ee", "#facc15", "#f472b6", "#a3e635", "#94a3b8"];
const carrierColor = (index: number) => CARRIER_COLORS[index % CARRIER_COLORS.length];
const CN_CARRIERS = ["China Telecom", "China Unicom", "China Mobile"];
const MAX_STRANDS = 6;
type AbroadLink = [from: number, country: string, city: string, lat: number, lon: number, shared: number, km: number];
type CountryCities = { cities: City[]; links: CityLink[]; abroad: AbroadLink[]; carriers?: string[] };
type CityData = { source: string; retrieved: string; metroRadiusKm: number; countries: Record<string, CountryCities> };

// Loaded once and shared by every panel instance.
let cityDataPromise: Promise<CityData> | null = null;
function loadCityData() {
  cityDataPromise ??= fetch("/data/peering-cities.json").then((response) => (response.ok ? response.json() : Promise.reject(response.status)));
  return cityDataPromise;
}

function useCityData() {
  const [data, setData] = useState<CityData | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    loadCityData()
      .then((json) => alive && setData(json))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);
  return { data, failed };
}

/* ---------- local projection fitted to one country ---------- */

const WIDTH = 1000;
const MAP_RADIUS_KM = 3500; // far-flung territories (e.g. Pacific islands) are listed, not drawn

function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(Math.min(1, h)));
}

function fitProjection(cities: City[], hub: City) {
  const unwrap = (lon: number) => (lon - hub[2] > 180 ? lon - 360 : lon - hub[2] < -180 ? lon + 360 : lon);
  const shown = cities.map((city) => distanceKm({ lat: city[1], lon: city[2] }, { lat: hub[1], lon: hub[2] }) <= MAP_RADIUS_KM);
  const inView = cities.filter((_, index) => shown[index]);
  const lats = inView.map((city) => city[1]);
  const lons = inView.map((city) => unwrap(city[2]));
  const span = (values: number[]) => Math.max(0.5, Math.max(...values) - Math.min(...values));
  const pad = 0.12;
  const cosLat = Math.cos(((Math.max(...lats) + Math.min(...lats)) / 2) * (Math.PI / 180));
  const lonSpan = span(lons) * (1 + 2 * pad);
  const latSpan = span(lats) * (1 + 2 * pad);
  const minLon = Math.min(...lons) - span(lons) * pad;
  const maxLat = Math.max(...lats) + span(lats) * pad;
  const height = Math.round(Math.min(1150, Math.max(420, (WIDTH * latSpan) / (lonSpan * cosLat))));
  const scale = Math.min(WIDTH / (lonSpan * cosLat), height / latSpan);
  const offsetX = (WIDTH - lonSpan * cosLat * scale) / 2;
  const offsetY = (height - latSpan * scale) / 2;
  const project = (lat: number, lon: number) => ({ x: offsetX + (unwrap(lon) - minLon) * cosLat * scale, y: offsetY + (maxLat - lat) * scale });
  return { project, shown, height };
}

const MAX_CITY_ZOOM = 24;
type CityView = { x: number; y: number; w: number };
function clampCityView(x: number, y: number, w: number, aspect: number): CityView {
  const width = clamp(w, WIDTH / MAX_CITY_ZOOM, WIDTH);
  return { x: clamp(x, 0, WIDTH - width), y: clamp(y, 0, WIDTH * aspect - width * aspect), w: width };
}
// Zoom by `factor`, keeping the point at fractional position (fx, fy) fixed under the cursor.
function zoomCityView(view: CityView, factor: number, aspect: number, fx = 0.5, fy = 0.5): CityView {
  const width = clamp(view.w * factor, WIDTH / MAX_CITY_ZOOM, WIDTH);
  const px = view.x + fx * view.w;
  const py = view.y + fy * view.w * aspect;
  return clampCityView(px - fx * width, py - fy * width * aspect, width, aspect);
}

function arc(a: { x: number; y: number }, b: { x: number; y: number }, curve = 0.12) {
  const bend = Math.hypot(b.x - a.x, b.y - a.y) * curve;
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}Q${((a.x + b.x) / 2).toFixed(1)} ${((a.y + b.y) / 2 - bend).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

/* ---------- panel ---------- */

type Props = { code: string; name: string; facilities: Facility[]; countryName: (code: string) => string; onSelectCountry: (code: string) => void };

export default function CityNetwork(props: Props) {
  const { data, failed } = useCityData();
  if (failed) return <p className="mt-10 text-sm text-rose-300">Could not load /data/peering-cities.json.</p>;
  if (!data) return <p className="mt-10 font-mono text-xs text-slate-500">Loading city-level data…</p>;
  const country = data.countries[props.code];
  if (!country || country.cities.length === 0) return null;
  // Remount per country so the selected city resets to that country's main hub.
  return <CityNetworkView key={props.code} {...props} country={country} radiusKm={data.metroRadiusKm} />;
}

function CityNetworkView({ name, facilities, countryName, onSelectCountry, country, radiusKm }: Props & { country: CountryCities; radiusKm: number }) {
  const geoPoints = useMemo<GeoPoint[]>(
    () => facilities.map(([lon, lat, , networks, facilityName, facilityCity, approx]) => ({ lon, lat, name: facilityName, city: facilityCity, networks, approx: Boolean(approx) })),
    [facilities],
  );
  const reduced = useReducedMotion();
  const ranked = useMemo(() => country.cities.map((_, index) => index).sort((a, b) => cityScore(country.cities[b]) - cityScore(country.cities[a])), [country]);
  const hubIndex = ranked[0];
  const [selected, setSelected] = useState(hubIndex);

  const { project, shown, height } = useMemo(() => fitProjection(country.cities, country.cities[hubIndex]), [country, hubIndex]);

  // Pan / zoom over the fitted country map (viewBox is WIDTH x height at 1x).
  const { ref: frameRef, full, toggle: toggleFullscreen } = useFullscreen();
  const svgRef = useRef<SVGSVGElement>(null);
  const engagedRef = useRef(false);
  const draggedRef = useRef(false);
  const [view, setView] = useState({ x: 0, y: 0, w: WIDTH });
  const aspect = height / WIDTH;
  const s = view.w / WIDTH; // multiply sizes by this so dots and labels keep their on-screen size
  const zoomLevel = WIDTH / view.w;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      if (!engagedRef.current && !event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = svg.getBoundingClientRect();
      const fx = (event.clientX - rect.left) / rect.width;
      const fy = (event.clientY - rect.top) / rect.height;
      setView((current) => zoomCityView(current, event.deltaY > 0 ? 1.15 : 1 / 1.15, aspect, fx, fy));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [aspect]);

  const startDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    engagedRef.current = true;
    draggedRef.current = false;
    const rect = event.currentTarget.getBoundingClientRect();
    const origin = { x: event.clientX, y: event.clientY, view };
    const move = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - origin.x;
      const dy = moveEvent.clientY - origin.y;
      if (Math.hypot(dx, dy) > 4) draggedRef.current = true;
      setView(clampCityView(origin.view.x - (dx / rect.width) * origin.view.w, origin.view.y - (dy / rect.height) * origin.view.w * aspect, origin.view.w, aspect));
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
  };
  const points = useMemo(() => country.cities.map((city) => project(city[1], city[2])), [country, project]);
  const strongest = Math.max(1, ...country.links.map((link) => link[2]));
  const mostNetworks = Math.max(1, ...country.cities.map((city) => city[4]));

  const cityLinks = country.links
    .filter((link) => link[0] === selected || link[1] === selected)
    .map(([a, b, shared, km, kind = 0, carrier = 0]) => ({ other: a === selected ? b : a, shared, km, kind, carrier }))
    .sort((x, y) => Number(y.kind === 0 || y.kind === 3) - Number(x.kind === 0 || x.kind === 3) || y.shared - x.shared || x.km - y.km);
  const cityAbroad = country.abroad.filter((link) => link[0] === selected);
  const partnerSet = new Set(cityLinks.map((link) => link.other));
  const labelled = new Set([...ranked.slice(0, country.cities.length <= 35 ? country.cities.length : Math.round(10 * zoomLevel ** 1.5)), selected, ...cityLinks.slice(0, 6).map((link) => link.other), ...country.cities.flatMap((c, i) => (c[8] ? [i] : []))]);
  const offMap = country.cities.filter((_, index) => !shown[index]);
  const city = country.cities[selected];

  const drawable = country.links.filter(([a, b]) => shown[a] && shown[b]);
  const ordered = [...drawable].sort((x, y) => Number(x[0] === selected || x[1] === selected) - Number(y[0] === selected || y[1] === selected));

  return (
    <div className="mt-12 border-t border-slate-800 pt-10">
      <p className="font-mono text-xs uppercase tracking-widest text-emerald-300">City level / {name}</p>
      <h4 className="mt-2 text-2xl font-semibold">Inside {name}: city-to-city interconnection</h4>
      <p className="mt-2 max-w-3xl text-sm text-slate-400">
        Data centres within {radiusKm} km are grouped into one metro. A line joins two metros when the same networks operate in both. Exchanges with no listed data centre and submarine-cable landing stations are added as their own points, so coastal and secondary cities show up too. Solid strands are measured — green-white from shared networks in PeeringDB, carrier-coloured from public RIPE Atlas traceroutes (a carrier's routers located in both cities on consecutive hops, geolocated by round-trip-time constraints); dashed lines are modelled (shortest-distance backhaul, and in China the three carriers' backbones between MIIT direct-connection points) and are labelled as such. Select a city to trace where it extends — at home and abroad.
      </p>

      <div className="mt-3 flex flex-wrap gap-4 font-mono text-[11px] text-slate-400">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#d1fae5]" />data-centre metro</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#c4b5fd]" />exchange only</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#67e8f9]" />cable landing station</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full border border-[#f472b6]" />national backbone point (CN)</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 font-mono text-[11px] text-slate-400">
        <span><span className="mr-1 inline-block h-px w-5 bg-[#8fe3bc] align-middle" />measured · one strand per shared network (up to {MAX_STRANDS})</span>
        <span><span className="mr-1 inline-block w-5 border-t border-dashed border-slate-400 align-middle" />modelled backhaul · keeps every point attached</span>
        {(country.carriers ?? []).map((carrierName, index) => (
          <span key={carrierName}>
            <span className="mr-1 inline-block h-0.5 w-5 align-middle" style={{ background: carrierColor(index) }} />
            {carrierName} · traced (RIPE Atlas){index < 3 && country.carriers?.[0] === "China Telecom" ? ", dashed = modelled" : ""}
          </span>
        ))}
      </div>

      <div className="mt-6 grid gap-8 xl:grid-cols-2">
        {/* Country map */}
        <div
          ref={frameRef}
          onPointerLeave={() => (engagedRef.current = false)}
          className={`relative overflow-hidden bg-slate-950 ${full ? "flex h-screen flex-col justify-center" : "rounded-xl border border-slate-800"}`}
        >
          <svg
            ref={svgRef}
            viewBox={`${view.x} ${view.y} ${view.w} ${view.w * aspect}`}
            onPointerDown={startDrag}
            className={`w-full cursor-grab touch-none select-none active:cursor-grabbing ${full ? "max-h-screen" : "h-auto"}`}
            role="img"
            aria-label={`City-to-city interconnection map of ${name}`}
          >
            {ordered.map(([a, b, shared, , kind = 0, carrier = 0]) => {
              const active = a === selected || b === selected;
              if (kind === 3) {
                // Traced: solid, in the carrier's colour; one strand per distinct router pair seen (capped).
                const strands = Math.min(4, Math.max(1, Math.ceil(Math.log2(shared + 1))));
                return Array.from({ length: strands }, (_, i) => (
                  <path key={`${a}-${b}-t${carrier}-${i}`} d={arc(points[a], points[b], -0.08 - carrier * 0.07 - i * 0.025)} fill="none"
                    stroke={carrierColor(carrier)} strokeWidth={active ? 2 : 1.4} strokeOpacity={active ? 1 : 0.8} vectorEffect="non-scaling-stroke" />
                ));
              }
              if (kind === 1) {
                return (
                  <path key={`${a}-${b}`} d={arc(points[a], points[b], 0.05)} fill="none" stroke={active ? "#f2b954" : "#94a3b8"}
                    strokeWidth={active ? 1.4 : 0.9} strokeOpacity={active ? 0.9 : 0.35} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                );
              }
              if (kind === 2) {
                return CN_CARRIERS.map((carrierName, i) => (
                  <path key={`${a}-${b}-${i}`} d={arc(points[a], points[b], 0.06 + i * 0.05)} fill="none" stroke={carrierColor(i)} aria-label={carrierName}
                    strokeWidth={active ? 1.8 : 1.2} strokeOpacity={active ? 1 : 0.7} strokeDasharray="6 3" vectorEffect="non-scaling-stroke" />
                ));
              }
              // Measured link: one strand per shared network (capped), fanned out so the multiplicity is visible.
              const strands = Math.min(MAX_STRANDS, Math.max(1, shared));
              return Array.from({ length: strands }, (_, i) => (
                <path
                  key={`${a}-${b}-${i}`}
                  d={arc(points[a], points[b], 0.12 + (i - (strands - 1) / 2) * 0.045)}
                  fill="none"
                  stroke={active ? "#f2b954" : "#8fe3bc"}
                  strokeWidth={0.6 + 1.6 * Math.sqrt(shared / strongest)}
                  strokeOpacity={active ? 0.9 : 0.15 + 0.35 * Math.sqrt(shared / strongest)}
                  vectorEffect="non-scaling-stroke"
                />
              ));
            })}

            {!reduced &&
              cityLinks
                .filter((link) => shown[link.other] && shown[selected])
                .slice(0, 24)
                .map((link, rank) => (
                  <circle key={`pulse-${link.other}-${link.kind}-${link.carrier}`} r={4 * s} fill="#fff1d6">
                    <animateMotion dur={`${1.8 + (rank % 4) * 0.35}s`} begin={`${(rank * 0.23) % 1.5}s`} repeatCount="indefinite" path={arc(points[selected], points[link.other])} />
                  </circle>
                ))}

            {country.cities.map((item, index) => {
              if (!shown[index]) return null;
              const isSelected = index === selected;
              const isPartner = partnerSet.has(index);
              const kind = cityKind(item);
              const radius = (kind === "metro" ? 3 + 14 * Math.sqrt(item[4] / mostNetworks) : 4) * s;
              return (
                <g key={index} className="cursor-pointer" onClick={() => !draggedRef.current && setSelected(index)}>
                  <circle cx={points[index].x} cy={points[index].y} r={radius + 6 * s} fill="transparent" />
                  <circle
                    cx={points[index].x}
                    cy={points[index].y}
                    r={radius}
                    fill={isSelected ? "#f2b954" : isPartner ? "#fde68a" : KIND_FILL[kind]}
                    fillOpacity={isSelected || isPartner ? 1 : 0.7}
                    stroke="#020617"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                  {item[8] ? (
                    <circle cx={points[index].x} cy={points[index].y} r={radius + 3.5 * s} fill="none" stroke="#f472b6" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
                  ) : null}
                  {labelled.has(index) && (
                    <text
                      x={points[index].x + radius + 5 * s}
                      y={points[index].y + 4 * s}
                      className="select-none"
                      fill={isSelected ? "#fcd34d" : "#cbd5e1"}
                      fontSize={(isSelected ? 17 : 13) * s}
                      fontWeight={isSelected ? 600 : 400}
                      paintOrder="stroke"
                      stroke="#020617"
                      strokeWidth={3 * s}
                    >
                      {item[0]}
                    </text>
                  )}
                  <title>{`${item[0]} · ${item[3]} data centres · ${item[4]} networks · ${item[5]} exchanges${item[7] ? ` · ${item[7]} cable landings` : ""}${item[6] ? ` · ${item[6]} placed at city level` : ""}`}</title>
                </g>
              );
            })}
          </svg>
          <ZoomControls
            onZoomIn={() => setView((current) => zoomCityView(current, 1 / 1.6, aspect))}
            onZoomOut={() => setView((current) => zoomCityView(current, 1.6, aspect))}
            onReset={() => setView({ x: 0, y: 0, w: WIDTH })}
            full={full}
            onFullscreen={toggleFullscreen}
          />
          <p className="pointer-events-none absolute left-3 top-3 font-mono text-[11px] text-slate-400">
            {zoomLevel > 1.01 ? <span className="text-cyan-300">{zoomLevel.toFixed(1)}×</span> : "Click the map then scroll to zoom · drag to pan"}
          </p>
          {offMap.length > 0 && (
            <p className="border-t border-slate-800 px-4 py-2 text-xs text-slate-500">
              Not drawn (over {MAP_RADIUS_KM.toLocaleString("en-US")} km from {country.cities[hubIndex][0]}): {offMap.map((item) => item[0]).join(", ")}
            </p>
          )}
        </div>

        {/* Real geography: OpenStreetMap street map following the selected city */}
        <GeoMap center={{ lat: city[1], lon: city[2] }} zoom={CITY_ZOOM} points={geoPoints} label={`${city[0]}, ${name}`} />

        {/* City detail */}
        <div className="xl:col-span-2 xl:max-w-4xl">
          <label htmlFor="city-select" className="font-mono text-xs uppercase tracking-widest text-slate-400">City</label>
          <select
            id="city-select"
            value={selected}
            onChange={(event) => setSelected(Number(event.target.value))}
            className="mt-2 block w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-300 focus:outline-none"
          >
            {ranked.map((index) => (
              <option key={index} value={index}>
                {country.cities[index][0]} — {cityKind(country.cities[index]) === "metro" ? `${country.cities[index][4]} networks` : cityKind(country.cities[index]) === "exchange" ? `${country.cities[index][5]} exchange(s)` : `${country.cities[index][7]} cable landing(s)`}
              </option>
            ))}
          </select>

          <div className="mt-5 grid grid-cols-4 gap-3">
            {[
              [city[3], "data centres"],
              [city[4], "networks"],
              [city[5], "exchanges"],
              [city[7] ?? 0, "cable landings"],
            ].map(([value, label]) => (
              <div key={label} className="border-t border-slate-700 pt-2">
                <p className="text-xl font-semibold text-amber-300">{value}</p>
                <p className="text-xs text-slate-400">{label}</p>
              </div>
            ))}
          </div>

          <h5 className="mt-6 font-mono text-xs uppercase tracking-widest text-slate-400">{city[0]} → other cities in {name}</h5>
          {cityLinks.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No links recorded.</p>
          ) : (
            <ul className="mt-2 max-h-56 divide-y divide-slate-800 overflow-y-auto border-y border-slate-800 text-sm">
              {cityLinks.map((link) => (
                <li key={`${link.other}-${link.kind}-${link.carrier}`}>
                  <button type="button" onClick={() => setSelected(link.other)} className="flex w-full items-center justify-between gap-3 py-2 pr-2 text-left hover:bg-slate-900">
                    <span>→ {country.cities[link.other][0]}</span>
                    <span className="font-mono text-xs text-slate-400">
                      {link.kind === 0 ? `${link.shared} nets` : link.kind === 3 ? `${country.carriers?.[link.carrier] ?? `carrier ${link.carrier + 1}`} · traced (${link.shared} router pairs)` : link.kind === 2 ? "backbone (modelled)" : "backhaul (modelled)"} · {link.km.toLocaleString("en-US")} km · ≥ {minRttMs(link.km).toFixed(1)} ms
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <h5 className="mt-6 font-mono text-xs uppercase tracking-widest text-slate-400">{city[0]} → cities abroad</h5>
          {cityAbroad.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No strong international city links recorded for {city[0]}.</p>
          ) : (
            <ul className="mt-2 max-h-56 divide-y divide-slate-800 overflow-y-auto border-y border-slate-800 text-sm">
              {cityAbroad.map(([, code, foreignCity, , , shared, km]) => (
                <li key={`${code}-${foreignCity}`}>
                  <button type="button" onClick={() => onSelectCountry(code)} className="flex w-full items-center justify-between gap-3 py-2 pr-2 text-left hover:bg-slate-900">
                    <span>→ {foreignCity}<span className="text-slate-500"> · {countryName(code)}</span></span>
                    <span className="font-mono text-xs text-slate-400">
                      {shared} nets · {km.toLocaleString("en-US")} km · ≥ {minRttMs(km).toFixed(0)} ms
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">Selecting a foreign city opens that country.</p>
          {(city[6] ?? 0) > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              {city[6]} of {city[3]} data centres in {city[0]} had no coordinates in PeeringDB and are placed at the city&apos;s location.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
