"use client";

import { useMemo, useState, useSyncExternalStore, type CSSProperties } from "react";
import Link from "next/link";
import BackLink from "./back-link";
import { NetworkNodeVisual } from "./network-visual";
import { netKnowledge } from "./network-knowledge";
import { allNetNodes, layout, mediumColors, netEdges, sectors, type NetEdgeId, type NetNodeId } from "./network-topology";
import { engineeringNotes, greatCircleKm, landlockedCountries, minRttMs } from "./internet-atlas";
import { CableGlobe3D, CableMap2D, landingCentroid, useCableData, useReducedMotion, type Cable, type CableData } from "./network-globe";
import { LandGlobe3D, LandMap2D, REGIONAL_KM, useLandData, type LinkScope } from "./land-globe";
import CityNetwork from "./city-network";
import dynamic from "next/dynamic";

const SatelliteLayer = dynamic(() => import("./satellite-layer"), { ssr: false });
const SunPanel = dynamic(() => import("./sun-panel"), { ssr: false });
const SolarSystem = dynamic(() => import("./solar-system"), { ssr: false });

/** Wide screens have room beside the 1152 px column: the Sun goes on the left, the solar system on the right. */
const FLANK_QUERY = "(min-width: 1840px)";
// Each side column takes all the room beside the page column (minus the 1.5 rem gap and a 1 rem edge), up to 620 px.
const FLANK_WIDTH: CSSProperties = { width: "min(620px, calc((100vw - 1152px) / 2 - 40px))" };
function useFlanks() {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(FLANK_QUERY);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(FLANK_QUERY).matches,
    () => false,
  );
}

/* ---------- local topology: from a home router to the global core ---------- */

// What actually happens on each hop — the protocol, device or mechanism in play.
const hopDetail: Record<NetEdgeId, string> = {
  "residential-access": "Wi-Fi or Ethernet to the home gateway (NAT, DHCP), then GPON fibre or DOCSIS cable on the last mile.",
  "residential-tower": "5G NR / LTE radio to the cell site; the handset usually sits behind carrier-grade NAT.",
  "enterprise-access": "Dedicated fibre from the edge firewall; branches are stitched together with MPLS or SD-WAN overlays.",
  "government-access": "Leased lines through a managed security gateway; classified enclaves never touch this path at all.",
  "public-tower": "Guest 802.11 Wi-Fi or cellular offload, with client isolation so visitors cannot see each other.",
  "public-access": "Campus or library fibre uplink behind a captive portal and content filtering.",
  "private-access": "Dark fibre and cross-connects inside a colocation facility, dual-homed to diverse carriers.",
  "access-isp": "Aggregation into the ISP's broadband network gateway, which authenticates the subscriber and assigns the public address.",
  "tower-isp": "Cell-site backhaul over fibre or microwave into the mobile packet core.",
  "isp-dns": "Recursive resolution over UDP/53 or encrypted DNS (DoH / DoT), validating DNSSEC where it is enforced.",
  "isp-cdn": "Anycast delivers the request to the nearest cache; only misses travel back to the origin.",
  "isp-ixp": "Settlement-free BGP peering across the exchange fabric instead of paying for transit.",
  "ixp-backbone": "IP transit: routes to the rest of the Internet learned over BGP from a Tier 1 carrier.",
  "backbone-cable": "DWDM wavelengths on long-haul and submarine fibre, re-amplified by repeaters every 50–100 km.",
};

const sectorIds = new Set<string>(sectors.map((sector) => sector.id));
const accentFor = (id: NetNodeId) => (sectorIds.has(id) ? "#f2b954" : "#63d9e8");
const accentVars = (accent: string) => ({ "--accent": accent, "--soft": `${accent}33` }) as CSSProperties;
const nodeLabel = (id: NetNodeId) => allNetNodes.find((node) => node.id === id)!.label;

// Topology drawn in a 160 x 90 box that matches the 16:9 container, so packets stay circular.
const pt = (id: NetNodeId) => ({ x: layout[id].x * 1.6, y: layout[id].y * 0.9 });

type Edge = (typeof netEdges)[number];
const adjacency = new Map<NetNodeId, { next: NetNodeId; edge: Edge }[]>();
for (const edge of netEdges) {
  adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), { next: edge.to, edge }]);
  adjacency.set(edge.to, [...(adjacency.get(edge.to) ?? []), { next: edge.from, edge }]);
}

/** Shortest hop path (BFS) from any node to the submarine / long-haul core. */
function traceToCore(start: NetNodeId) {
  const previous = new Map<NetNodeId, { node: NetNodeId; edge: Edge }>();
  const queue: NetNodeId[] = [start];
  const seen = new Set<NetNodeId>([start]);
  while (queue.length) {
    const node = queue.shift()!;
    if (node === "cable") break;
    for (const { next, edge } of adjacency.get(node) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      previous.set(next, { node, edge });
      queue.push(next);
    }
  }
  const nodes: NetNodeId[] = ["cable"];
  const edges: Edge[] = [];
  let cursor: NetNodeId = "cable";
  while (cursor !== start) {
    const step = previous.get(cursor);
    if (!step) break;
    edges.unshift(step.edge);
    nodes.unshift(step.node);
    cursor = step.node;
  }
  return { nodes, edges };
}

/* ---------- global layer: per-country index over the cable dataset ---------- */

function buildCountryIndex(data: CableData) {
  const index = new Map<string, { landings: number; cables: Cable[] }>();
  const entry = (country: string) => {
    if (!index.has(country)) index.set(country, { landings: 0, cables: [] });
    return index.get(country)!;
  };
  data.landings.forEach(([, country]) => entry(country).landings++);
  data.cables.forEach((cable) => cable.countries.forEach((country) => entry(country).cables.push(cable)));
  return index;
}

const landlocked = new Set<string>(landlockedCountries);

// ISO 3166 codes (PeeringDB) → English country names, using the browser's built-in region names.
const regionNames = typeof Intl !== "undefined" && "DisplayNames" in Intl ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
const countryName = (code: string) => {
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
};

export default function NetworkResearch() {
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState<NetNodeId>("residential");
  const [view, setView] = useState<"3d" | "2d">("3d");
  const [country, setCountry] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const { data, borders, failed } = useCableData();
  const flanks = useFlanks();
  const { data: land, failed: landFailed } = useLandData();
  const [landView, setLandView] = useState<"3d" | "2d">("3d");
  const [landScope, setLandScope] = useState<LinkScope>("regional");
  const [landCountry, setLandCountry] = useState<string | null>(null);

  const node = allNetNodes.find((item) => item.id === selected)!;
  const knowledge = netKnowledge[selected];
  const accent = accentFor(selected);
  const trace = useMemo(() => traceToCore(selected), [selected]);
  const traceIds = new Set<string>(trace.edges.map((edge) => edge.id));
  const tracePath = trace.nodes.map((id, index) => `${index ? "L" : "M"} ${pt(id).x} ${pt(id).y}`).join(" ");

  const countryIndex = useMemo(() => (data ? buildCountryIndex(data) : null), [data]);
  const countryNames = useMemo(
    () => (countryIndex ? [...new Set([...countryIndex.keys(), ...landlocked])].sort((a, b) => a.localeCompare(b)) : []),
    [countryIndex],
  );
  const mostConnected = useMemo(
    () => (countryIndex ? [...countryIndex].sort((a, b) => b[1].cables.length - a[1].cables.length).slice(0, 10).map(([name]) => name) : []),
    [countryIndex],
  );
  const selectedEntry = country ? countryIndex?.get(country) : undefined;
  const partners = useMemo(() => {
    if (!data || !country || !selectedEntry) return [];
    const shared = new Map<string, string[]>();
    selectedEntry.cables.forEach((cable) =>
      cable.countries.forEach((other) => {
        if (other !== country) shared.set(other, [...(shared.get(other) ?? []), cable.name]);
      }),
    );
    const origin = landingCentroid(data, country);
    return [...shared]
      .map(([name, cables]) => {
        const target = landingCentroid(data, name);
        return { name, cables, km: origin && target ? greatCircleKm(origin, target) : null };
      })
      .sort((a, b) => b.cables.length - a.cables.length || a.name.localeCompare(b.name));
  }, [data, country, selectedEntry]);

  const landCountries = useMemo(
    () => (land ? Object.keys(land.countries).sort((a, b) => countryName(a).localeCompare(countryName(b))) : []),
    [land],
  );
  const landFacilities = useMemo(() => (land && landCountry ? land.facilities.filter((facility) => facility[2] === landCountry) : []), [land, landCountry]);
  const landPartners = useMemo(() => {
    if (!land || !landCountry) return [];
    return land.links
      .filter((link) => link[0] === landCountry || link[1] === landCountry)
      .map(([a, b, shared, km]) => ({ code: a === landCountry ? b : a, shared, km }))
      .sort((x, y) => y.shared - x.shared);
  }, [land, landCountry]);

  const chooseCountry = (name: string | null) => {
    setCountry(name);
    setQuery(name ?? "");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-lg font-semibold tracking-tight hover:text-emerald-300">首页</Link>
        <BackLink fallback="/#work" />
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        {/* Hero */}
        <section className="border-b border-slate-800 pb-12 pt-12 sm:pt-20">
          <p className="font-mono text-xs uppercase tracking-widest text-emerald-400">Research dossier / Network concept / 02</p>
          <h1 className="mt-5 max-w-4xl text-4xl font-bold leading-tight sm:text-6xl">How the Internet actually moves a packet</h1>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-400">
            From a router in a family home, an enterprise, a government enclave or a public library — through radio towers, access fibre and
            ISPs — to the exchanges, backbones and submarine cables that tie countries together. Every layer below is interactive.
          </p>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 border-t border-slate-800 pt-5 font-mono text-xs text-slate-400">
            <span><strong className="text-amber-300">LAYER 1</strong> / access networks</span>
            <span><strong className="text-cyan-300">LAYER 2</strong> / global interconnection</span>
            <span><strong className="text-emerald-300">LAYER 3</strong> / engineering principles</span>
          </div>
        </section>

        {/* Layer 1: topology + packet trace */}
        <section aria-labelledby="topology-title" className="py-14">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-amber-300">Layer 1 / access networks</p>
              <h2 id="topology-title" className="mt-3 text-2xl font-semibold sm:text-3xl">From a home router to the global core</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">Select where traffic starts. The bright packet follows the shortest path to the submarine core; every hop is explained below.</p>
            </div>
            <div className="flex gap-5 font-mono text-xs text-slate-400">
              <span className="flex items-center gap-2"><i className="inline-block h-0.5 w-6" style={{ background: mediumColors.wired }} />Wired</span>
              <span className="flex items-center gap-2"><i className="inline-block w-6 border-t-2 border-dashed" style={{ borderColor: mediumColors.wireless }} />Radio</span>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="relative aspect-[16/9] min-w-[760px]">
              <svg viewBox="0 0 160 90" className="absolute inset-0 h-full w-full" aria-hidden="true">
                {netEdges.map((edge, index) => {
                  const a = pt(edge.from);
                  const b = pt(edge.to);
                  const onTrace = traceIds.has(edge.id);
                  const d = `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
                  return (
                    <g key={edge.id}>
                      <path
                        d={d}
                        stroke={mediumColors[edge.medium]}
                        strokeWidth={onTrace ? 2.6 : 1.2}
                        strokeOpacity={onTrace ? 1 : 0.3}
                        strokeDasharray={edge.medium === "wireless" ? "5 4" : undefined}
                        vectorEffect="non-scaling-stroke"
                      />
                      {!reduced && (
                        <circle r={0.7} fill={mediumColors[edge.medium]} opacity={0.55}>
                          <animateMotion dur={`${2.6 + (index % 4) * 0.5}s`} begin={`${(index * 0.37) % 2}s`} repeatCount="indefinite" path={d} />
                        </circle>
                      )}
                    </g>
                  );
                })}
                {!reduced && trace.edges.length > 0 && (
                  <circle key={selected} r={1.5} fill="#f8fafc">
                    <animateMotion dur={`${trace.edges.length * 0.9}s`} repeatCount="indefinite" path={tracePath} />
                  </circle>
                )}
              </svg>

              {allNetNodes.map((item) => {
                const { x, y } = layout[item.id];
                const isSelected = item.id === selected;
                const onTrace = trace.nodes.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelected(item.id)}
                    style={{ left: `${x}%`, top: `${y}%`, ...accentVars(accentFor(item.id)) }}
                    className={`absolute max-w-[128px] -translate-x-1/2 -translate-y-1/2 rounded-md border px-2.5 py-1.5 text-center text-[11px] font-medium leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                      isSelected
                        ? "border-[var(--accent)] bg-[var(--accent)] text-slate-950"
                        : onTrace
                          ? "border-[var(--accent)] bg-slate-900 text-white"
                          : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hop-by-hop trace */}
          <div className="mt-8">
            <h3 className="font-mono text-xs uppercase tracking-widest text-slate-400">Packet trace / {node.label} → global core</h3>
            {trace.edges.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">This is the global core itself — every trace ends here.</p>
            ) : (
              <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {trace.edges.map((edge, index) => (
                  <li key={edge.id} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="text-emerald-400">HOP {String(index + 1).padStart(2, "0")}</span>
                      <span style={{ color: mediumColors[edge.medium] }}>{edge.medium === "wireless" ? "radio" : "wired"}</span>
                    </div>
                    <p className="mt-2 text-sm font-semibold">{nodeLabel(trace.nodes[index])} → {nodeLabel(trace.nodes[index + 1])}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">{hopDetail[edge.id]}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>

        {/* Selected node knowledge */}
        <section aria-labelledby="node-title" className="border-t border-slate-800 py-14" style={accentVars(accent)}>
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-[var(--accent)]">Node knowledge / {knowledge.code}</p>
              <h2 id="node-title" className="mt-3 text-2xl font-semibold sm:text-3xl">{node.label}</h2>
            </div>
            <p className="max-w-md text-sm text-slate-400">{node.description}</p>
          </div>
          <div key={selected} className="mt-8 grid h-[300px] place-items-center overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950">
            <NetworkNodeVisual id={selected} steps={knowledge.steps} />
          </div>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {[
              ["01 / MECHANISM", "What runs here", knowledge.principle],
              ["02 / TRUST BOUNDARY", "What must not cross", knowledge.boundary],
              ["03 / TEST CLAIM", "What would verify it", knowledge.verification],
            ].map(([tag, title, text]) => (
              <div key={tag} className="border-t border-slate-700 pt-4">
                <span className="font-mono text-xs text-[var(--accent)]">{tag}</span>
                <h3 className="mt-2 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Layer 2: global interconnection — every submarine cable and landing station */}
        <section aria-labelledby="global-title" className="border-t border-slate-800 py-14">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-cyan-300">Layer 2 / global interconnection</p>
              <h2 id="global-title" className="mt-3 text-2xl font-semibold sm:text-3xl">Every country&apos;s cables to the world</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Every submarine cable and landing station on Earth. Select a country to light up its cables and see which countries it connects to directly.
              </p>
            </div>
            <div aria-label="Map view" className="inline-flex self-start border border-slate-700 p-1">
              {(["3d", "2d"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={view === option}
                  onClick={() => setView(option)}
                  className={`min-h-9 px-4 text-xs font-semibold ${view === option ? "bg-cyan-300 text-slate-950" : "text-slate-300 hover:text-white"}`}
                >
                  {option === "3d" ? "3D globe" : "2D map"}
                </button>
              ))}
            </div>
          </div>

          {/* Country finder */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <label htmlFor="country-search" className="font-mono text-xs uppercase tracking-widest text-slate-400">Country</label>
            <input
              id="country-search"
              list="country-list"
              value={query}
              placeholder="Type a country, e.g. Japan"
              onChange={(event) => {
                const value = event.target.value;
                setQuery(value);
                const match = countryNames.find((name) => name.toLowerCase() === value.trim().toLowerCase());
                if (match) setCountry(match);
              }}
              className="w-64 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-300 focus:outline-none"
            />
            <datalist id="country-list">
              {countryNames.map((name) => <option key={name} value={name} />)}
            </datalist>
            {country && (
              <button type="button" onClick={() => chooseCountry(null)} className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:border-slate-500">
                Global view
              </button>
            )}
          </div>

          {failed && <p className="rounded-xl border border-rose-900 bg-rose-950/40 p-6 text-sm text-rose-200">Could not load /data/submarine-cables.json.</p>}
          {!failed && !data && <div className="grid h-[460px] place-items-center rounded-xl border border-slate-800 font-mono text-xs text-slate-500">Loading cable data…</div>}
          {data && (view === "3d" ? (
            <CableGlobe3D data={data} borders={borders} selected={country} onSelect={chooseCountry} />
          ) : (
            <CableMap2D data={data} borders={borders} selected={country} onSelect={chooseCountry} />
          ))}

          {data && countryIndex && (
            <div className="mt-10">
              {!country && (
                <div>
                  <div className="grid gap-6 sm:grid-cols-3">
                    {[
                      [data.cables.length.toLocaleString("en-US"), "submarine cable systems"],
                      [data.landings.length.toLocaleString("en-US"), "landing stations"],
                      [countryIndex.size.toLocaleString("en-US"), "countries and territories with a landing"],
                    ].map(([value, label]) => (
                      <div key={label} className="border-t border-slate-700 pt-4">
                        <p className="text-3xl font-semibold text-cyan-300">{value}</p>
                        <p className="mt-1 text-sm text-slate-400">{label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-8 font-mono text-xs uppercase tracking-widest text-slate-400">Most connected</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {mostConnected.map((name) => (
                      <button key={name} type="button" onClick={() => chooseCountry(name)} className="rounded-full border border-slate-700 px-4 py-1.5 text-sm text-slate-300 hover:border-cyan-300">
                        {name} · {countryIndex.get(name)!.cables.length}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {country && !selectedEntry && (
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                  <h3 className="text-2xl font-semibold">{country}</h3>
                  <p className="mt-3 max-w-2xl leading-relaxed text-slate-400">
                    {landlocked.has(country)
                      ? `${country} has no coastline, so it has no landing stations of its own. Its international traffic crosses a neighbour's territory over terrestrial fibre to reach that neighbour's cable landings — which makes transit agreements and cross-border routes part of its critical infrastructure.`
                      : `No submarine cable landing is recorded for ${country} in this dataset.`}
                  </p>
                </div>
              )}

              {country && selectedEntry && (
                <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-widest text-amber-300">Selected country</p>
                    <h3 className="mt-2 text-3xl font-semibold">{country}</h3>
                    <div className="mt-6 grid grid-cols-3 gap-4">
                      {[
                        [selectedEntry.cables.length, "cables"],
                        [selectedEntry.landings, "landing stations"],
                        [partners.length, "direct partners"],
                      ].map(([value, label]) => (
                        <div key={label} className="border-t border-slate-700 pt-3">
                          <p className="text-2xl font-semibold text-amber-300">{value}</p>
                          <p className="mt-1 text-xs text-slate-400">{label}</p>
                        </div>
                      ))}
                    </div>
                    {selectedEntry.cables.length <= 2 && (
                      <p className="mt-6 rounded-lg border border-amber-900 bg-amber-950/30 p-4 text-sm leading-relaxed text-amber-100">
                        Low path diversity: with {selectedEntry.cables.length === 1 ? "a single cable" : "only two cables"}, one cut could remove most of {country}&apos;s international capacity.
                      </p>
                    )}
                  </div>
                  <div>
                    <h4 className="font-mono text-xs uppercase tracking-widest text-slate-400">Directly connected countries</h4>
                    {partners.length === 0 ? (
                      <p className="mt-4 text-sm text-slate-400">Only domestic cables are recorded for {country}.</p>
                    ) : (
                      <ul className="mt-4 max-h-[420px] divide-y divide-slate-800 overflow-y-auto border-y border-slate-800">
                        {partners.map((partner) => (
                          <li key={partner.name}>
                            <button type="button" onClick={() => chooseCountry(partner.name)} className="grid w-full gap-1 py-3 pr-2 text-left hover:bg-slate-900 sm:grid-cols-[1fr_auto] sm:items-center">
                              <span>
                                <span className="font-semibold">{partner.name}</span>
                                <span className="block text-xs text-slate-400">
                                  {partner.cables.slice(0, 3).join(", ")}
                                  {partner.cables.length > 3 && ` +${partner.cables.length - 3} more`}
                                </span>
                              </span>
                              {partner.km !== null && (
                                <span className="font-mono text-xs text-slate-300">
                                  {Math.round(partner.km).toLocaleString("en-US")} km · ≥ {minRttMs(partner.km).toFixed(0)} ms RTT
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-3 text-xs text-slate-500">
                      Distances run between each country&apos;s landing-station centroid along the great circle; RTT is the physical floor for light in fibre (~204,000 km/s).
                    </p>
                  </div>
                </div>
              )}

              <p className="mt-10 text-xs text-slate-500">
                Submarine cable and landing-station data: TeleGeography, Submarine Cable Map (submarinecablemap.com), licensed CC BY-NC-SA 3.0; cable-to-country links derived by matching route endpoints to landing stations.
                {borders && " Country borders: Natural Earth (public domain)."}
              </p>
            </div>
          )}
        </section>

        {/* Layer 2b: interconnection on land — PeeringDB data centres and cross-border operator presence */}
        <section aria-labelledby="land-title" className="border-t border-slate-800 py-14">
          <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-emerald-300">Layer 2 / interconnection on land</p>
              <h2 id="land-title" className="mt-3 text-2xl font-semibold sm:text-3xl">Where networks meet on land</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Every data centre that operators register in PeeringDB. A line joins two countries when the same networks are present in both — the thicker the line, the more operators span that border.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div aria-label="Link scope" className="inline-flex border border-slate-700 p-1">
                {(["regional", "all"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={landScope === option}
                    onClick={() => setLandScope(option)}
                    className={`min-h-9 px-4 text-xs font-semibold ${landScope === option ? "bg-emerald-300 text-slate-950" : "text-slate-300 hover:text-white"}`}
                  >
                    {option === "regional" ? `Neighbours (≤ ${REGIONAL_KM.toLocaleString("en-US")} km)` : "Strongest worldwide"}
                  </button>
                ))}
              </div>
              <div aria-label="Map view" className="inline-flex border border-slate-700 p-1">
                {(["3d", "2d"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={landView === option}
                    onClick={() => setLandView(option)}
                    className={`min-h-9 px-4 text-xs font-semibold ${landView === option ? "bg-emerald-300 text-slate-950" : "text-slate-300 hover:text-white"}`}
                  >
                    {option === "3d" ? "3D globe" : "2D map"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-3">
            <label htmlFor="land-country" className="font-mono text-xs uppercase tracking-widest text-slate-400">Country</label>
            <select
              id="land-country"
              value={landCountry ?? ""}
              onChange={(event) => setLandCountry(event.target.value || null)}
              className="w-64 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-emerald-300 focus:outline-none"
            >
              <option value="">Global view</option>
              {landCountries.map((code) => <option key={code} value={code}>{countryName(code)}</option>)}
            </select>
          </div>

          {landFailed && <p className="rounded-xl border border-rose-900 bg-rose-950/40 p-6 text-sm text-rose-200">Could not load /data/peering-interconnect.json.</p>}
          {!landFailed && !land && <div className="grid h-[460px] place-items-center rounded-xl border border-slate-800 font-mono text-xs text-slate-500">Loading interconnection data…</div>}
          {land && (landView === "3d" ? (
            <LandGlobe3D data={land} scope={landScope} selected={landCountry} onSelect={setLandCountry} />
          ) : (
            <LandMap2D data={land} scope={landScope} selected={landCountry} onSelect={setLandCountry} />
          ))}

          {land && (
            <div className="mt-10">
              {!landCountry && (
                <div className="grid gap-10 lg:grid-cols-2">
                  <div className="grid grid-cols-3 gap-4 self-start">
                    {[
                      [land.facilities.length.toLocaleString("en-US"), "data centres"],
                      [Object.keys(land.countries).length.toLocaleString("en-US"), "countries"],
                      [land.links.length.toLocaleString("en-US"), "cross-border pairs"],
                    ].map(([value, label]) => (
                      <div key={label} className="border-t border-slate-700 pt-4">
                        <p className="text-3xl font-semibold text-emerald-300">{value}</p>
                        <p className="mt-1 text-sm text-slate-400">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h4 className="font-mono text-xs uppercase tracking-widest text-slate-400">Strongest cross-border pairs</h4>
                    <ul className="mt-4 divide-y divide-slate-800 border-y border-slate-800">
                      {land.links.slice(0, 8).map(([a, b, shared, km]) => (
                        <li key={`${a}-${b}`}>
                          <button type="button" onClick={() => setLandCountry(a)} className="flex w-full items-center justify-between gap-4 py-2.5 text-left text-sm hover:bg-slate-900">
                            <span>{countryName(a)} ↔ {countryName(b)}</span>
                            <span className="font-mono text-xs text-slate-400">{shared} networks · {km.toLocaleString("en-US")} km</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {landCountry && land.countries[landCountry] && (
                <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-widest text-amber-300">Selected country</p>
                    <h3 className="mt-2 text-3xl font-semibold">{countryName(landCountry)}</h3>
                    <div className="mt-6 grid grid-cols-3 gap-4">
                      {[
                        [land.countries[landCountry].facilities, "data centres"],
                        [land.countries[landCountry].ixps, "exchanges (IXPs)"],
                        [land.countries[landCountry].networks, "networks present"],
                      ].map(([value, label]) => (
                        <div key={label} className="border-t border-slate-700 pt-3">
                          <p className="text-2xl font-semibold text-amber-300">{value}</p>
                          <p className="mt-1 text-xs text-slate-400">{label}</p>
                        </div>
                      ))}
                    </div>
                    {land.countries[landCountry].topIx.length > 0 && (
                      <>
                        <h4 className="mt-8 font-mono text-xs uppercase tracking-widest text-slate-400">Largest exchanges</h4>
                        <ul className="mt-3 space-y-2 text-sm">
                          {land.countries[landCountry].topIx.map(([name, city, networks]) => (
                            <li key={name} className="flex justify-between gap-4">
                              <span>{name}<span className="text-slate-500"> · {city}</span></span>
                              <span className="font-mono text-xs text-slate-400">{networks} networks</span>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                  <div>
                    <h4 className="font-mono text-xs uppercase tracking-widest text-slate-400">Shared operators with other countries</h4>
                    {landPartners.length === 0 ? (
                      <p className="mt-4 text-sm text-slate-400">No cross-border operator presence recorded for {countryName(landCountry)}.</p>
                    ) : (
                      <ul className="mt-4 max-h-[420px] divide-y divide-slate-800 overflow-y-auto border-y border-slate-800">
                        {landPartners.slice(0, 40).map((partner) => (
                          <li key={partner.code}>
                            <button type="button" onClick={() => setLandCountry(partner.code)} className="grid w-full gap-1 py-3 pr-2 text-left hover:bg-slate-900 sm:grid-cols-[1fr_auto] sm:items-center">
                              <span>
                                <span className="font-semibold">{countryName(partner.code)}</span>
                                <span className="block text-xs text-slate-400">
                                  {partner.shared} networks in both{partner.km <= REGIONAL_KM ? " · neighbouring market" : ""}
                                </span>
                              </span>
                              <span className="font-mono text-xs text-slate-300">
                                {partner.km.toLocaleString("en-US")} km · ≥ {minRttMs(partner.km).toFixed(0)} ms RTT
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {landCountry && (
                <CityNetwork
                  code={landCountry}
                  name={countryName(landCountry)}
                  facilities={landFacilities}
                  countryName={countryName}
                  onSelectCountry={setLandCountry}
                />
              )}

              <p className="mt-10 max-w-4xl text-xs leading-relaxed text-slate-500">
                Data: PeeringDB (peeringdb.com), the interconnection database maintained by network operators themselves; retrieved {land.retrieved}.
                Lines show where the same networks are present on both sides of a border — evidence of cross-border backbone reach, not the route of any individual fibre.
                Country positions are the network-weighted centre of their data centres; distances and RTT floors are measured between those centres.
              </p>
            </div>
          )}
        </section>

        {/* Layer 2c: communication satellites — live positions from public orbital elements */}
        <section aria-labelledby="orbit-title" className="relative border-t border-slate-800 py-14">
          {flanks && (
            <>
              <div className="absolute bottom-14 right-full top-14 mr-6" style={FLANK_WIDTH}>
                <div className="sticky top-6"><SunPanel /></div>
              </div>
              <div className="absolute bottom-14 left-full top-14 ml-6" style={FLANK_WIDTH}>
                <div className="sticky top-6"><SolarSystem /></div>
              </div>
            </>
          )}
          <p className="font-mono text-xs uppercase tracking-widest text-emerald-300">Layer 2 / in orbit</p>
          <h2 id="orbit-title" className="mt-3 text-2xl font-semibold sm:text-3xl">The network above: satellites and what they do</h2>
          <p className="mt-2 mb-6 max-w-3xl text-sm text-slate-400">
            Every tracked communication satellite — the LEO mega-constellations, Iridium, O3b in medium orbit and the geostationary belt — plus space stations, weather, Earth-observation, navigation and science satellites, placed where they are right now.
            Select one to see what it is, who runs it, which countries and cities sit inside its coverage, and what it openly publishes.
          </p>
          <SatelliteLayer borders={borders} countryName={countryName} />
          {!flanks && (
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <SunPanel />
              <SolarSystem />
            </div>
          )}
        </section>

        {/* Layer 3: engineering principles */}
        <section aria-labelledby="principles-title" className="border-t border-slate-800 py-14">
          <p className="font-mono text-xs uppercase tracking-widest text-emerald-300">Layer 3 / engineering principles</p>
          <h2 id="principles-title" className="mt-3 text-2xl font-semibold sm:text-3xl">What holds it all together — and where it breaks</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            {engineeringNotes.map((note) => (
              <article key={note.tag} className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                <span className="font-mono text-xs text-emerald-400">{note.tag}</span>
                <h3 className="mt-2 text-lg font-semibold">{note.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{note.body}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
