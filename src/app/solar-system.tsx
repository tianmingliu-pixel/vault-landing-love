"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { ZoomControls, useFullscreen } from "./network-globe";
import { SUN_VIEWS, ageText, useSunImage, useSunView } from "./sun-panel";
import BodyIntel, { BODY_CODES, type BodyLink } from "./body-intel";
import GalaxyInset from "./galaxy-inset";
import { buildSatelliteModel } from "./satellite-model";
import type { FunctionKind } from "./satellite-function";

/* The solar system, live: planets from JPL's approximate Keplerian elements (Standish, valid 1800–2050),
   deep-space missions from JPL Horizons, and which of them NASA's Deep Space Network is talking to right now. */

type Elements = [a: number, e: number, i: number, L: number, peri: number, node: number];
const PLANETS: { name: string; color: number; size: number; el: Elements; rate: Elements }[] = [
  { name: "Mercury", color: 0xa8a29e, size: 0.08, el: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593], rate: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081] },
  { name: "Venus", color: 0xfde68a, size: 0.11, el: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255], rate: [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418] },
  { name: "Earth", color: 0x60a5fa, size: 0.12, el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0] },
  { name: "Mars", color: 0xf87171, size: 0.1, el: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891], rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343] },
  { name: "Jupiter", color: 0xfbbf24, size: 0.24, el: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], rate: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106] },
  { name: "Saturn", color: 0xeab308, size: 0.21, el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], rate: [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794] },
  { name: "Uranus", color: 0x67e8f9, size: 0.16, el: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503], rate: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589] },
  { name: "Neptune", color: 0x818cf8, size: 0.16, el: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], rate: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664] },
  { name: "Pluto", color: 0xd6b8a8, size: 0.06, el: [39.48211675, 0.2488273, 17.14001206, 238.92903833, 224.06891629, 110.30393684], rate: [-0.00031596, 0.0000517, 0.00004818, 145.20780515, -0.04062942, -0.01183482] },
];

const RAD = Math.PI / 180;

/** Heliocentric ecliptic position (au) of a planet at a Julian date. */
function planetAt(planet: (typeof PLANETS)[number], jd: number, meanAnomalyOverride?: number) {
  const T = (jd - 2451545) / 36525;
  const [a, e, inc, L, peri, node] = planet.el.map((v, k) => v + planet.rate[k] * T);
  const omega = peri - node;
  let M = (meanAnomalyOverride ?? L - peri) % 360;
  if (M > 180) M -= 360;
  if (M < -180) M += 360;
  const m = M * RAD;
  let E = m + e * Math.sin(m);
  for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const [co, so, cn, sn, ci, si] = [Math.cos(omega * RAD), Math.sin(omega * RAD), Math.cos(node * RAD), Math.sin(node * RAD), Math.cos(inc * RAD), Math.sin(inc * RAD)];
  return {
    x: (co * cn - so * sn * ci) * xp + (-so * cn - co * sn * ci) * yp,
    y: (co * sn + so * cn * ci) * xp + (-so * sn + co * cn * ci) * yp,
    z: so * si * xp + co * si * yp,
  };
}

/** Distances shown on a square-root scale so Mercury and Voyager 1 fit in one view; directions are true. */
const toScene = (p: { x: number; y: number; z: number }) => {
  const r = Math.hypot(p.x, p.y, p.z) || 1e-9;
  const s = Math.sqrt(r) / r;
  return new THREE.Vector3(p.x * s, p.z * s, -p.y * s);
};

type Mission = { key: string; name: string; x: number; y: number; z: number };
type DsnLink = BodyLink;

/** Bodies you can click for their intel panel, in order from the Sun. */
const BODY_ORDER = ["Sun", "Mercury", "Venus", "Earth", "Moon", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];

/** Approximate geocentric ecliptic longitude of the Moon (mean longitude; good to a few degrees — enough to place it beside Earth). */
const moonLongitude = (jd: number) => ((218.316 + 13.176396 * (jd - 2451545)) % 360) * (Math.PI / 180);

/** DSN spacecraft codes that sit at a planet (orbiters, landers) rather than at their own Horizons position. */
const AT_BODY: Record<string, string> = {
  MRO: "Mars", MROS: "Mars", M20: "Mars", MSL: "Mars", MVN: "Mars", M01O: "Mars", M01S: "Mars", ODY: "Mars", TGO: "Mars", EMM: "Mars", MEX: "Mars", HOPE: "Mars",
  LRO: "Moon", KPLO: "Moon", CAPS: "Moon", CH2: "Moon", CH2O: "Moon", CH3: "Moon", THB: "Moon", THC: "Moon", EM2: "Moon", EM3: "Moon",
};
const CODE_ALIAS: Record<string, string> = { VGR1: "VGR1", VGR2: "VGR2", NHPC: "NHPC", SPP: "SPP", JNO: "JNO", JUNO: "JNO", EURC: "EURC", ECLP: "EURC", JUIC: "JUICE", JUICE: "JUICE", BEPI: "BEPI", PSYC: "PSYC", PSYCHE: "PSYC", LUCY: "LUCY", ORX: "ORX", JWST: "JWST" };

function useDeepSpace() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [links, setLinks] = useState<DsnLink[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    fetch("/api/deep-space")
      .then((r) => r.json())
      .then((j: { missions: Mission[] }) => alive && setMissions(j.missions ?? []))
      .catch(() => undefined);
    fetch("https://eyes.nasa.gov/dsn/config.xml")
      .then((r) => r.text())
      .then((xml) => {
        const doc = new DOMParser().parseFromString(xml, "text/xml");
        const map: Record<string, string> = {};
        doc.querySelectorAll("spacecraft").forEach((node) => (map[(node.getAttribute("name") ?? "").toUpperCase()] = node.getAttribute("friendlyName") ?? ""));
        if (alive) setNames(map);
      })
      .catch(() => undefined);
    const loadDsn = () =>
      fetch(`https://eyes.nasa.gov/dsn/data/dsn.xml?r=${Math.floor(Date.now() / 5000)}`)
        .then((r) => r.text())
        .then((xml) => {
          const doc = new DOMParser().parseFromString(xml, "text/xml");
          const out: DsnLink[] = [];
          let station = "";
          Array.from(doc.documentElement.children).forEach((node) => {
            if (node.tagName === "station") station = node.getAttribute("friendlyName") ?? "";
            if (node.tagName !== "dish") return;
            node.querySelectorAll("downSignal").forEach((signal) => {
              const code = (signal.getAttribute("spacecraft") ?? "").toUpperCase();
              const target = Array.from(node.querySelectorAll("target")).find((t) => (t.getAttribute("name") ?? "").toUpperCase() === code);
              const range = Number(target?.getAttribute("downlegRange") ?? -1);
              const power = Number(signal.getAttribute("power"));
              if (!code || signal.getAttribute("active") !== "true" || code === "DSN") return;
              out.push({
                station,
                dish: node.getAttribute("name") ?? "",
                code,
                name: code,
                downRate: Number(signal.getAttribute("dataRate") ?? 0),
                band: signal.getAttribute("band") ?? "",
                activity: node.getAttribute("activity") ?? "",
                power: Number.isFinite(power) && signal.getAttribute("power") !== "" ? power : null,
                rangeKm: range > 0 ? range : null,
              });
            });
          });
          // One row per dish and spacecraft: merge several downlink channels (e.g. JWST's S and K band) into one.
          const merged = new Map<string, DsnLink>();
          for (const link of out) {
            const key = `${link.dish}|${link.code}`;
            const prev = merged.get(key);
            if (!prev) merged.set(key, link);
            else merged.set(key, { ...prev, band: prev.band.includes(link.band) ? prev.band : `${prev.band}/${link.band}`, downRate: Math.max(prev.downRate, link.downRate) });
          }
          if (alive) setLinks([...merged.values()]);
        })
        .catch(() => undefined);
    loadDsn();
    const id = window.setInterval(loadDsn, 30000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  return { missions, links: links.map((l) => ({ ...l, name: names[l.code] || l.code })) };
}

const SPEEDS = [
  { label: "real time", daysPerSecond: 1 / 86400 },
  { label: "1 h/s", daysPerSecond: 1 / 24 },
  { label: "1 day/s", daysPerSecond: 1 },
  { label: "10 days/s", daysPerSecond: 10 },
  { label: "30 days/s", daysPerSecond: 30 },
];

/** Sidereal rotation period (hours; negative = retrograde) and axial tilt (degrees), NASA planetary fact sheets. */
const SPIN: Record<string, { hours: number; tilt: number }> = {
  Mercury: { hours: 1407.6, tilt: 0.03 },
  Venus: { hours: -5832.5, tilt: 177.4 },
  Earth: { hours: 23.9345, tilt: 23.44 },
  Mars: { hours: 24.6229, tilt: 25.19 },
  Jupiter: { hours: 9.925, tilt: 3.13 },
  Saturn: { hours: 10.656, tilt: 26.73 },
  Uranus: { hours: -17.24, tilt: 97.77 },
  Neptune: { hours: 16.11, tilt: 28.32 },
  Pluto: { hours: -153.29, tilt: 122.53 },
};

/** Major moons: semi-major axis (km) and orbital period (days); orbits drawn in the planet's equatorial plane.
    Periods and the order of distances are real; orbit radii are compressed to stay visible, and starting phases are schematic. */
type MoonSpec = { name: string; aKm: number; days: number; retro?: boolean };
const MOONS: Record<string, MoonSpec[]> = {
  Mars: [{ name: "Phobos", aKm: 9376, days: 0.31891 }, { name: "Deimos", aKm: 23463, days: 1.26244 }],
  Jupiter: [
    { name: "Io", aKm: 421700, days: 1.769138 },
    { name: "Europa", aKm: 671034, days: 3.551181 },
    { name: "Ganymede", aKm: 1070412, days: 7.154553 },
    { name: "Callisto", aKm: 1882709, days: 16.689018 },
  ],
  Saturn: [
    { name: "Mimas", aKm: 185539, days: 0.942422 },
    { name: "Enceladus", aKm: 237948, days: 1.370218 },
    { name: "Tethys", aKm: 294619, days: 1.887802 },
    { name: "Dione", aKm: 377396, days: 2.736915 },
    { name: "Rhea", aKm: 527108, days: 4.518212 },
    { name: "Titan", aKm: 1221870, days: 15.945 },
    { name: "Iapetus", aKm: 3560820, days: 79.3215 },
  ],
  Uranus: [
    { name: "Miranda", aKm: 129390, days: 1.413479 },
    { name: "Ariel", aKm: 191020, days: 2.520379 },
    { name: "Umbriel", aKm: 266000, days: 4.144177 },
    { name: "Titania", aKm: 435910, days: 8.705872 },
    { name: "Oberon", aKm: 583520, days: 13.463239 },
  ],
  Neptune: [
    { name: "Proteus", aKm: 117647, days: 1.122315 },
    { name: "Triton", aKm: 354759, days: 5.876854, retro: true },
  ],
  Pluto: [{ name: "Charon", aKm: 19591, days: 6.3872 }],
};
const MOON_PARENT: Record<string, string> = Object.fromEntries(Object.entries(MOONS).flatMap(([planet, list]) => list.map((m) => [m.name, planet])));
MOON_PARENT.Moon = "Earth";

/** Human spacecraft orbiting (or sitting on) a body. Periods, periapsis/apoapsis and inclinations are published mission
    values (rounded); the drawn orbit sizes are compressed logarithmically so a 400 km orbit and a 40,000 km one both show. */
type Orbiter = { code?: string; name: string; agency: string; body: string; hours: number; periKm: number; apoKm: number; incl: number; kind: FunctionKind; note: string };
const BODY_RADIUS_KM: Record<string, number> = { Earth: 6371, Moon: 1737.4, Mars: 3389.5, Jupiter: 69911 };
const ORBITERS: Orbiter[] = [
  { name: "ISS", agency: "NASA · Roscosmos · ESA · JAXA · CSA", body: "Earth", hours: 1.545, periKm: 413, apoKm: 422, incl: 51.64, kind: "station", note: "crewed station — live HD Earth video" },
  { name: "Hubble", agency: "NASA · ESA", body: "Earth", hours: 1.58, periKm: 510, apoKm: 520, incl: 28.5, kind: "science", note: "space telescope" },
  { name: "GOES-19", agency: "NOAA", body: "Earth", hours: 23.934, periKm: 35786, apoKm: 35786, incl: 0.1, kind: "weather", note: "geostationary weather imager; carries the SUVI Sun camera" },
  { code: "LRO", name: "LRO", agency: "NASA", body: "Moon", hours: 1.9, periKm: 50, apoKm: 165, incl: 90, kind: "science", note: "Lunar Reconnaissance Orbiter, mapping since 2009" },
  { code: "KPLO", name: "Danuri", agency: "KARI", body: "Moon", hours: 2, periKm: 100, apoKm: 100, incl: 90, kind: "eo", note: "Korea Pathfinder Lunar Orbiter" },
  { code: "CH2O", name: "Chandrayaan-2", agency: "ISRO", body: "Moon", hours: 2, periKm: 100, apoKm: 100, incl: 90, kind: "eo", note: "lunar orbiter" },
  { code: "THB", name: "ARTEMIS P1", agency: "NASA", body: "Moon", hours: 26, periKm: 1500, apoKm: 18000, incl: 10, kind: "science", note: "plasma probe in a wide lunar orbit (approximate)" },
  { code: "MRO", name: "MRO", agency: "NASA", body: "Mars", hours: 1.87, periKm: 255, apoKm: 320, incl: 93, kind: "eo", note: "Mars Reconnaissance Orbiter — HiRISE camera, relay for the rovers" },
  { code: "MVN", name: "MAVEN", agency: "NASA", body: "Mars", hours: 3.5, periKm: 150, apoKm: 4500, incl: 75, kind: "science", note: "upper-atmosphere orbiter, relay" },
  { code: "M01O", name: "Mars Odyssey", agency: "NASA", body: "Mars", hours: 1.96, periKm: 370, apoKm: 450, incl: 93, kind: "eo", note: "THEMIS camera, relay" },
  { code: "MEX", name: "Mars Express", agency: "ESA", body: "Mars", hours: 6.7, periKm: 300, apoKm: 10100, incl: 86, kind: "eo", note: "HRSC stereo camera" },
  { code: "TGO", name: "ExoMars TGO", agency: "ESA · Roscosmos", body: "Mars", hours: 2, periKm: 400, apoKm: 400, incl: 74, kind: "science", note: "trace-gas orbiter, relay" },
  { code: "EMM", name: "Hope", agency: "UAE", body: "Mars", hours: 55, periKm: 20000, apoKm: 43000, incl: 25, kind: "weather", note: "Emirates Mars Mission — whole-planet weather" },
  { code: "JNO", name: "Juno", agency: "NASA", body: "Jupiter", hours: 33 * 24, periKm: 3500, apoKm: 5_000_000, incl: 90, kind: "science", note: "polar orbiter, JunoCam" },
];
/** Rovers on the surface: they turn with the planet. */
const LANDERS = [
  { code: "M20", name: "Perseverance", body: "Mars", lat: 18.44, lon: 77.45 },
  { code: "MSL", name: "Curiosity", body: "Mars", lat: -4.59, lon: 137.44 },
];
const CRAFT_BODY: Record<string, string> = Object.fromEntries([...ORBITERS, ...LANDERS].map((o) => [o.name, o.body]));

/** Radius in the scene of an orbit `altKm` above a body drawn with radius `r` (log-compressed). */
const orbitRadius = (r: number, altKm: number, bodyKm: number) => r * (1.25 + 0.5 * Math.log10(1 + (10 * altKm) / bodyKm));

/** Turning faster than once every 2 s turns into flicker on screen, so fast spins and orbits are shown at that cap. */
const CAP_RAD_PER_S = Math.PI;

/** A banded surface with a bright meridian stripe, so a planet's spin can be seen. */
function spinTexture(color: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const base = new THREE.Color(color);
  for (let y = 0; y < 128; y += 8) {
    const shade = base.clone().offsetHSL(0, 0, Math.sin(y * 0.37) * 0.08 - 0.04);
    ctx.fillStyle = `#${shade.getHexString()}`;
    ctx.fillRect(0, y, 256, 8);
  }
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(0, 0, 10, 128);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(128, 0, 10, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const circle = (radius: number, segments = 96) => Array.from({ length: segments + 1 }, (_, k) => new THREE.Vector3(Math.cos((k / segments) * Math.PI * 2) * radius, 0, Math.sin((k / segments) * Math.PI * 2) * radius));

const rate = (bps: number) => (bps >= 1e6 ? `${(bps / 1e6).toFixed(1)} Mb/s` : bps >= 1e3 ? `${(bps / 1e3).toFixed(1)} kb/s` : `${bps} b/s`);

/** Earth–body distance in au right now (Moon handled by the intel panel; the Sun is the origin). */
function distanceFromEarth(body: string) {
  const jd = Date.now() / 86400000 + 2440587.5;
  const earth = planetAt(PLANETS[2], jd);
  if (body === "Sun") return Math.hypot(earth.x, earth.y, earth.z);
  const planet = PLANETS.find((p) => p.name === body);
  if (!planet) return null;
  const p = planetAt(planet, jd);
  return Math.hypot(p.x - earth.x, p.y - earth.y, p.z - earth.z);
}

/** Card for a clicked spacecraft: what it is, its orbit, and whether the DSN is hearing it right now. */
function CraftCard({ name, missionName, links, onClose }: { name: string; missionName: (key: string) => string; links: BodyLink[]; onClose: () => void }) {
  const orbiter = ORBITERS.find((o) => o.name === name);
  const lander = LANDERS.find((l) => l.name === name);
  const code = orbiter?.code ?? lander?.code ?? Object.entries(CODE_ALIAS).find(([, key]) => key === name)?.[0] ?? name;
  const live = links.filter((l) => l.code === code);
  return (
    <div className="absolute left-2 top-9 z-10 w-60 rounded-md border border-amber-500/50 bg-slate-950/90 p-2 text-[10px] text-slate-300">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[11px] text-amber-200">{orbiter?.name ?? lander?.name ?? missionName(name)}</p>
        <button type="button" onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-white">×</button>
      </div>
      {orbiter && (
        <>
          <p className="text-slate-400">{orbiter.agency} · orbiting {orbiter.body}</p>
          <p className="mt-1">{orbiter.note}</p>
          <p className="mt-1 font-mono text-[9px] text-slate-400">
            period {orbiter.hours < 48 ? `${orbiter.hours.toFixed(2)} h` : `${(orbiter.hours / 24).toFixed(1)} d`} · {orbiter.periKm.toLocaleString("en-US")} × {orbiter.apoKm.toLocaleString("en-US")} km · inclination {orbiter.incl}°
          </p>
        </>
      )}
      {lander && <p className="text-slate-400">rover on {lander.body} · {lander.lat.toFixed(2)}°, {lander.lon.toFixed(2)}°E · turns with the planet</p>}
      {!orbiter && !lander && <p className="text-slate-400">in its own orbit around the Sun · position for today from JPL Horizons</p>}
      <p className={`mt-1 font-mono text-[9px] ${live.length ? "text-emerald-300" : "text-slate-500"}`}>
        {live.length ? `DSN receiving now · ${live.map((l) => `${l.station} ${l.dish} ${l.band}${l.downRate ? ` ${rate(l.downRate)}` : ""}`).join(" · ")}` : "no DSN downlink at this moment"}
      </p>
      {orbiter && <p className="mt-1 text-[8.5px] leading-snug text-slate-600">Orbit size compressed (log scale) to stay visible; fast orbits shown at most one turn per 2 s.</p>}
    </div>
  );
}

/** `compact`: the live 3D system and its controls only (for the home page); the full panel adds body intel, the DSN list and the galaxy. */
export default function SolarSystem({ compact = false }: { compact?: boolean } = {}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [speed, setSpeed] = useState(3);
  const speedRef = useRef(SPEEDS[3].daysPerSecond);
  const [dateLabel, setDateLabel] = useState("");
  const { missions, links } = useDeepSpace();
  const linksRef = useRef(links);
  const [focus, setFocus] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedCraft, setSelectedCraft] = useState<string | null>(null);
  const selectedCraftRef = useRef<string | null>(null);
  useEffect(() => {
    selectedCraftRef.current = selectedCraft;
  }, [selectedCraft]);
  const selectedRef = useRef<string | null>(null);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  const focusRef = useRef<string | null>(null);
  // The Sun here wears the same live image as the Sun panel (a coronagraph hides the disk, so it falls back to SUVI 195).
  const panelView = useSunView();
  const sunView = panelView === "C3" ? "SUVI195" : panelView;
  const sunImage = useSunImage(sunView);
  const sunUrlRef = useRef<string | null>(null);
  const setSunTextureRef = useRef<(url: string) => void>(() => undefined);
  const { ref: frameRef, full, toggle } = useFullscreen();
  const apiRef = useRef<{ zoom: (factor: number) => void; reset: () => void } | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 30000);
    return () => {
      window.clearInterval(id);
    };
  }, []);
  useEffect(() => {
    sunUrlRef.current = sunImage.url;
    if (sunImage.url) setSunTextureRef.current(sunImage.url);
  }, [sunImage.url]);

  useEffect(() => {
    speedRef.current = SPEEDS[speed].daysPerSecond;
  }, [speed]);
  useEffect(() => {
    linksRef.current = links;
  }, [links]);
  useEffect(() => {
    focusRef.current = focus;
  }, [focus]);

  const labelNames = useMemo(() => [...PLANETS.map((p) => p.name), "Moon", ...Object.keys(MOON_PARENT).filter((m) => m !== "Moon"), ...ORBITERS.map((o) => o.name), ...LANDERS.map((l) => l.name), ...missions.map((m) => m.key)], [missions]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 200);
    camera.position.set(0, 9, 12);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    host.appendChild(renderer.domElement);
    const owned: { dispose: () => void }[] = [];
    const own = <T extends { dispose: () => void }>(item: T) => (owned.push(item), item);

    // The Sun: the latest real image of it on a camera-facing sprite (black sky blends away), over a soft glow.
    const glow = new THREE.Mesh(own(new THREE.SphereGeometry(0.2, 32, 24)), own(new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.18, depthWrite: false })));
    scene.add(glow);
    const sunMaterial = own(new THREE.SpriteMaterial({ color: 0xffffff, depthWrite: false, transparent: true }));
    const sunSprite = new THREE.Sprite(sunMaterial);
    sunSprite.scale.setScalar(1.15);
    scene.add(sunSprite);
    const loader = new THREE.TextureLoader();
    let sunTexture: THREE.Texture | null = null;
    // The images are square (dark sky, captions in the corners): cut a soft-edged disc out of each so no square shows.
    setSunTextureRef.current = (url) =>
      loader.load(url, (source) => {
        const image = source.image as HTMLImageElement;
        const size = 512;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(image, 0, 0, size, size);
        ctx.globalCompositeOperation = "destination-in";
        const fade = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.48);
        fade.addColorStop(0, "rgba(0,0,0,1)");
        fade.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = fade;
        ctx.fillRect(0, 0, size, size);
        source.dispose();
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        sunTexture?.dispose();
        sunTexture = texture;
        sunMaterial.map = texture;
        sunMaterial.needsUpdate = true;
      });
    if (sunUrlRef.current) setSunTextureRef.current(sunUrlRef.current);

    // Distance rings at 1, 10 and 100 au (on the √ scale) for orientation.
    for (const au of [1, 10, 100]) {
      const ring: THREE.Vector3[] = [];
      for (let k = 0; k <= 128; k++) ring.push(new THREE.Vector3(Math.sqrt(au) * Math.cos((k / 128) * Math.PI * 2), 0, Math.sqrt(au) * Math.sin((k / 128) * Math.PI * 2)));
      const line = new THREE.Line(own(new THREE.BufferGeometry().setFromPoints(ring)), own(new THREE.LineDashedMaterial({ color: 0x334155, dashSize: 0.08, gapSize: 0.08 })));
      line.computeLineDistances();
      scene.add(line);
    }

    // Sunlight from the centre (no fall-off, so the outer planets stay visible) and a little fill for the night sides.
    const sunLight = new THREE.PointLight(0xffffff, 3.2, 0, 0);
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const textureLoader = new THREE.TextureLoader();
    const surfaceMap = (name: string, material: THREE.MeshLambertMaterial) =>
      textureLoader.load(`/textures/${name}.jpg`, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        own(texture);
        material.map = texture;
        material.needsUpdate = true;
      });

    const jdNow = () => Date.now() / 86400000 + 2440587.5;
    let jd = jdNow();

    // Planets and their orbits. Each planet sits in a group tilted by its axial tilt; inside it the globe spins at its
    // real sidereal rate (a white meridian stripe and a marker on the equator ring show the turning), with the spin axis,
    // the equator track, Saturn's rings and the major moons on their orbits in the equatorial plane.
    const bodies = PLANETS.map((planet) => {
      const orbit: THREE.Vector3[] = [];
      for (let k = 0; k <= 180; k++) orbit.push(toScene(planetAt(planet, jd, -180 + k * 2)));
      scene.add(new THREE.Line(own(new THREE.BufferGeometry().setFromPoints(orbit)), own(new THREE.LineBasicMaterial({ color: planet.color, transparent: true, opacity: 0.35 }))));
      const spin = SPIN[planet.name];
      const holder = new THREE.Group();
      scene.add(holder);
      const tilt = new THREE.Group();
      tilt.rotation.z = -spin.tilt * RAD;
      holder.add(tilt);
      const spinner = new THREE.Group();
      tilt.add(spinner);
      // Real surface / cloud-top map (lit by the Sun, so each planet has a day and a night side); banded colour until it loads.
      const surface = own(new THREE.MeshLambertMaterial({ map: own(spinTexture(planet.color)) }));
      spinner.add(new THREE.Mesh(own(new THREE.SphereGeometry(planet.size, 48, 32)), surface));
      surfaceMap(planet.name.toLowerCase(), surface);
      const r = planet.size;
      // Spin axis (north pole brighter) and equator track with a marker riding on it.
      const axis = new THREE.Line(own(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -r * 1.8, 0), new THREE.Vector3(0, r * 1.8, 0)])), own(new THREE.LineBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.55 })));
      tilt.add(axis);
      const track = new THREE.Line(own(new THREE.BufferGeometry().setFromPoints(circle(r * 1.3, 64))), own(new THREE.LineBasicMaterial({ color: planet.color, transparent: true, opacity: 0.8 })));
      tilt.add(track);
      const marker = new THREE.Mesh(own(new THREE.SphereGeometry(Math.max(0.012, r * 0.1), 8, 6)), own(new THREE.MeshBasicMaterial({ color: 0xffffff })));
      marker.position.set(r * 1.3, 0, 0);
      spinner.add(marker);
      if (planet.name === "Saturn") {
        // Ring texture runs along the radius: remap the ring's UVs so u = distance from the inner edge.
        const ringGeometry = own(new THREE.RingGeometry(r * 1.24, r * 2.27, 96, 1));
        const uv = ringGeometry.attributes.uv;
        const pos = ringGeometry.attributes.position;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - r * 1.24) / (r * 1.03), 0.5);
        const ringMaterial = own(new THREE.MeshLambertMaterial({ color: 0xe7d7a8, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
        textureLoader.load("/textures/saturn_ring.png", (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          own(texture);
          ringMaterial.map = texture;
          ringMaterial.color.set(0xffffff);
          ringMaterial.opacity = 1;
          ringMaterial.needsUpdate = true;
        });
        const rings = new THREE.Mesh(ringGeometry, ringMaterial);
        rings.rotation.x = -Math.PI / 2;
        tilt.add(rings);
      }
      const specs = MOONS[planet.name] ?? [];
      const aMax = Math.max(1, ...specs.map((m) => m.aKm));
      const moons = specs.map((spec, k) => {
        const radius = r * (2.0 + 2.8 * Math.sqrt(spec.aKm / aMax));
        tilt.add(new THREE.Line(own(new THREE.BufferGeometry().setFromPoints(circle(radius))), own(new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.35 }))));
        const mesh = new THREE.Mesh(own(new THREE.SphereGeometry(Math.max(0.014, r * 0.09), 16, 12)), own(new THREE.MeshLambertMaterial({ color: 0xd6d3d1 })));
        tilt.add(mesh);
        return { spec, mesh, radius, phase: k * 2.39996 };
      });
      // A fading trail along the orbit behind the planet shows which way and how fast it is going round the Sun.
      const periodDays = 365.25 * planet.el[0] ** 1.5;
      const trailPositions = new Float32Array(48 * 3);
      const trailColors = new Float32Array(48 * 3);
      const tint = new THREE.Color(planet.color);
      for (let k = 0; k < 48; k++) {
        const f = k / 47;
        trailColors.set([tint.r * f, tint.g * f, tint.b * f], k * 3);
      }
      const trailGeometry = own(new THREE.BufferGeometry());
      trailGeometry.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
      trailGeometry.setAttribute("color", new THREE.BufferAttribute(trailColors, 3));
      scene.add(new THREE.Line(trailGeometry, own(new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true }))));
      spinner.rotation.y = ((((jd - 2451545) * 24) / spin.hours) % 1) * Math.PI * 2;
      moons.forEach((moon) => (moon.phase += ((jd - 2451545) / moon.spec.days) * Math.PI * 2 * (moon.spec.retro ? -1 : 1)));
      return { planet, mesh: holder, tilt, spinner, moons, spin, trailPositions, trailGeometry, trailDays: Math.min(periodDays * 0.15, 3000) };
    });

    // The Moon, drawn just beside Earth in its true direction (its real distance is invisible at this scale), on its orbit.
    const MOON_R = 0.045;
    const MOON_ORBIT = 0.42;
    const moonSurface = own(new THREE.MeshLambertMaterial({ color: 0xd6d3d1 }));
    surfaceMap("moon", moonSurface);
    const moonMesh = new THREE.Mesh(own(new THREE.SphereGeometry(MOON_R, 32, 24)), moonSurface);
    scene.add(moonMesh);
    const moonOrbit = new THREE.Line(own(new THREE.BufferGeometry().setFromPoints(circle(MOON_ORBIT))), own(new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.35 })));
    scene.add(moonOrbit);
    const moonFrame = new THREE.Group();
    scene.add(moonFrame);

    // Human spacecraft around the bodies: a small 3D model on an elliptical orbit in the body's equatorial frame.

    const frameOf = (body: string) => (body === "Moon" ? moonFrame : bodies.find((b) => b.planet.name === body)?.tilt);
    const radiusOf = (body: string) => (body === "Moon" ? MOON_R : (PLANETS.find((p) => p.name === body)?.size ?? 0.1));
    const orbiters = ORBITERS.map((spec, k) => {
      const r = radiusOf(spec.body);
      const R = BODY_RADIUS_KM[spec.body];
      const rp = orbitRadius(r, spec.periKm, R);
      const ra = orbitRadius(r, spec.apoKm, R);
      const a = (rp + ra) / 2;
      const e = (ra - rp) / (ra + rp);
      const b = a * Math.sqrt(1 - e * e);
      const plane = new THREE.Group();
      plane.rotation.order = "YXZ";
      plane.rotation.y = k * 1.7;
      plane.rotation.x = (spec.incl * Math.PI) / 180;
      frameOf(spec.body)?.add(plane);
      const path = Array.from({ length: 97 }, (_, i) => {
        const E = (i / 96) * Math.PI * 2;
        return new THREE.Vector3(a * (Math.cos(E) - e), 0, b * Math.sin(E));
      });
      const lineMaterial = own(new THREE.LineBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.5 }));
      const line = new THREE.Line(own(new THREE.BufferGeometry().setFromPoints(path)), lineMaterial);
      line.visible = false;
      plane.add(line);
      const model = buildSatelliteModel(spec.kind, "#fbbf24");
      model.scale.setScalar(Math.max(0.03, r * 0.28));
      plane.add(model);
      owned.push({ dispose: () => model.traverse((c) => c instanceof THREE.Mesh && (c.geometry.dispose(), (c.material as THREE.Material).dispose())) });
      return { spec, plane, line, lineMaterial, model, a, e, b, M: k * 2.1 };
    });
    const landers = LANDERS.map((spec) => {
      const body = bodies.find((b) => b.planet.name === spec.body)!;
      const r = body.planet.size;
      const lat = (spec.lat * Math.PI) / 180;
      const lon = (spec.lon * Math.PI) / 180;
      const pin = new THREE.Mesh(own(new THREE.ConeGeometry(r * 0.12, r * 0.35, 8)), own(new THREE.MeshBasicMaterial({ color: 0xfbbf24 })));
      pin.position.set(Math.cos(lat) * Math.cos(lon) * r * 1.08, Math.sin(lat) * r * 1.08, -Math.cos(lat) * Math.sin(lon) * r * 1.08);
      pin.lookAt(pin.position.clone().multiplyScalar(2));
      pin.rotateX(Math.PI / 2);
      body.spinner.add(pin);
      return { spec, pin };
    });

    // Ring around the selected body.
    const ring = new THREE.Mesh(own(new THREE.RingGeometry(0.2, 0.24, 48)), own(new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9, side: THREE.DoubleSide })));
    ring.visible = false;
    scene.add(ring);

    // Missions (positions for today from Horizons).
    const craft = missions.map((m) => {
      const mesh = buildSatelliteModel("science", "#e2e8f0");
      mesh.scale.setScalar(0.07);
      mesh.position.copy(toScene(m));
      scene.add(mesh);
      owned.push({ dispose: () => mesh.traverse((c) => c instanceof THREE.Mesh && (c.geometry.dispose(), (c.material as THREE.Material).dispose())) });
      return { mission: m, mesh };
    });

    // DSN links: for every spacecraft a Deep Space Network antenna is receiving right now, an arc from the spacecraft
    // down to Earth with data packets travelling along it (one arc per spacecraft, lifted so arcs to the same planet fan out).
    const MAX_LINKS = 16;
    const ARC_POINTS = 33;
    const packetGeometry = own(new THREE.SphereGeometry(0.022, 8, 8));
    const packetMaterial = own(new THREE.MeshBasicMaterial({ color: 0xd1fae5 }));
    const arcs = Array.from({ length: MAX_LINKS }, () => {
      const positions = new Float32Array(ARC_POINTS * 3);
      const geometry = own(new THREE.BufferGeometry());
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const line = new THREE.Line(geometry, own(new THREE.LineBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.45 })));
      line.visible = false;
      scene.add(line);
      const dots = Array.from({ length: 3 }, () => {
        const mesh = new THREE.Mesh(packetGeometry, packetMaterial);
        mesh.visible = false;
        scene.add(mesh);
        return mesh;
      });
      return { positions, geometry, line, dots };
    });
    const bezier = (a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3) =>
      out.set(
        (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
        (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
        (1 - t) ** 2 * a.z + 2 * (1 - t) * t * c.z + t * t * b.z,
      );

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 0.25;
    controls.maxDistance = 40;
    let engaged = false;
    const engage = () => (engaged = true);
    const disengage = () => (engaged = false);
    const gateWheel = (event: WheelEvent) => {
      if (!engaged && !event.ctrlKey && !event.metaKey) event.stopPropagation();
    };
    host.addEventListener("pointerdown", engage);
    host.addEventListener("pointerleave", disengage);
    host.addEventListener("wheel", gateWheel, { capture: true });

    // Click (not drag) a planet, the Moon or the Sun to open its intel panel.
    let downAt: { x: number; y: number } | null = null;
    const onDown = (event: PointerEvent) => (downAt = { x: event.clientX, y: event.clientY });
    const onUp = (event: PointerEvent) => {
      if (!downAt || Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) > 5) return;
      const box = host.getBoundingClientRect();
      const ndc = new THREE.Vector2(((event.clientX - box.left) / box.width) * 2 - 1, -((event.clientY - box.top) / box.height) * 2 + 1);
      // Pick the body nearest the click on screen (small spheres are hard to hit exactly).
      // Spacecraft win ties (they sit on top of their planet), then bodies.
      const candidates = [
        ...orbiters.map((o) => ({ name: o.spec.name, craft: true, pos: o.model.getWorldPosition(new THREE.Vector3()) })),
        ...landers.map((l) => ({ name: l.spec.name, craft: true, pos: l.pin.getWorldPosition(new THREE.Vector3()) })),
        ...craft.map((c) => ({ name: c.mission.key, craft: true, pos: c.mesh.position })),
        ...bodies.map((b) => ({ name: b.planet.name, craft: false, pos: b.mesh.position })),
        { name: "Moon", craft: false, pos: moonMesh.position },
        { name: "Sun", craft: false, pos: new THREE.Vector3() },
      ];
      let best: { name: string; craft: boolean; d: number } | null = null;
      for (const c of candidates) {
        const p = c.pos.clone().project(camera);
        const d = Math.hypot(((p.x - ndc.x) * box.width) / 2, ((p.y - ndc.y) * box.height) / 2) - (c.craft ? 6 : 0);
        if (p.z < 1 && d < 22 && (!best || d < best.d)) best = { name: c.name, craft: c.craft, d };
      }
      if (!best) return;
      if (best.craft) {
        setSelectedCraft(best.name);
        if (CRAFT_BODY[best.name]) setSelected(CRAFT_BODY[best.name]);
      } else {
        setSelected(best.name);
        setSelectedCraft(null);
      }
    };
    host.addEventListener("pointerdown", onDown);
    host.addEventListener("pointerup", onUp);
    // + / − move the camera along its line of sight to the Sun; reset returns to the opening view.
    apiRef.current = {
      zoom: (factor) => {
        const distance = THREE.MathUtils.clamp(camera.position.length() * factor, controls.minDistance, controls.maxDistance);
        camera.position.setLength(distance);
        controls.update();
      },
      reset: () => {
        follow = null;
        camera.position.set(0, 9, 12);
        controls.target.set(0, 0, 0);
        controls.update();
      },
    };

    const resize = () => {
      const width = host.clientWidth || 1;
      const height = host.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const placeLabel = (key: string, world: THREE.Vector3, show = true) => {
      const el = labelRefs.current[key];
      if (!el) return;
      const p = world.clone().project(camera);
      const visible = show && p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
      el.style.display = visible ? "block" : "none";
      el.style.transform = `translate(${((p.x + 1) / 2) * host.clientWidth + 6}px, ${((1 - p.y) / 2) * host.clientHeight - 6}px)`;
    };

    // Camera follow: selecting a body glides the view onto it and keeps it centred as it orbits.
    let follow: string | null = null;
    let lastChosen: string | null = null;
    let fly = 0;
    let flyDistance = 4;
    const worldPos = new THREE.Vector3();

    let last = performance.now();
    let labelAt = 0;
    let frame = 0;
    // Advance an angle by `radPerDay` of simulated time, but never faster on screen than the flicker cap.
    const advance = (radPerDay: number, dtDays: number, dtSec: number) => {
      const step = radPerDay * dtDays;
      const cap = CAP_RAD_PER_S * dtSec;
      return Math.abs(step) > cap ? Math.sign(step) * cap : step;
    };
    const trailPoint = new THREE.Vector3();
    const loop = (now: number) => {
      const dtSec = Math.min(0.1, (now - last) / 1000);
      const dtDays = dtSec * speedRef.current;
      jd += dtDays;
      last = now;
      const earth = bodies[2];
      const chosen = selectedRef.current;
      const chosenCraft = selectedCraftRef.current;
      bodies.forEach(({ planet, mesh, spinner, moons, spin, trailPositions, trailGeometry, trailDays }) => {
        mesh.position.copy(toScene(planetAt(planet, jd)));
        placeLabel(planet.name, mesh.position);
        spinner.rotation.y += advance(((Math.PI * 2) / spin.hours) * 24, dtDays, dtSec);
        for (let k = 0; k < 48; k++) {
          trailPoint.copy(toScene(planetAt(planet, jd - trailDays * (1 - k / 47))));
          trailPositions.set([trailPoint.x, trailPoint.y, trailPoint.z], k * 3);
        }
        trailGeometry.attributes.position.needsUpdate = true;
        const near = chosen === planet.name || camera.position.distanceTo(mesh.position) < 2.5;
        for (const moon of moons) {
          moon.phase += advance(((Math.PI * 2) / moon.spec.days) * (moon.spec.retro ? -1 : 1), dtDays, dtSec);
          moon.mesh.position.set(Math.cos(moon.phase) * moon.radius, 0, -Math.sin(moon.phase) * moon.radius);
          placeLabel(moon.spec.name, moon.mesh.getWorldPosition(worldPos), near);
        }
      });
      const lambda = moonLongitude(jd);
      moonMesh.position.copy(earth.mesh.position).add(new THREE.Vector3(Math.cos(lambda) * MOON_ORBIT, 0, -Math.sin(lambda) * MOON_ORBIT));
      moonOrbit.position.copy(earth.mesh.position);
      moonFrame.position.copy(moonMesh.position);
      placeLabel("Moon", moonMesh.position);

      // Spacecraft on their orbits (Kepler's equation for the eccentric ones); orbit drawn when its body or it is selected.
      for (const o of orbiters) {
        o.M += advance(((Math.PI * 2) / o.spec.hours) * 24, dtDays, dtSec);
        let E = o.M;
        for (let k = 0; k < 6; k++) E -= (E - o.e * Math.sin(E) - o.M) / (1 - o.e * Math.cos(E));
        o.model.position.set(o.a * (Math.cos(E) - o.e), 0, o.b * Math.sin(E));
        o.model.lookAt(o.plane.localToWorld(new THREE.Vector3(o.a * (Math.cos(E + 0.2) - o.e), 0, o.b * Math.sin(E + 0.2))));
        const mine = chosenCraft === o.spec.name;
        o.line.visible = mine || chosen === o.spec.body;
        o.lineMaterial.opacity = mine ? 1 : 0.35;
        o.lineMaterial.color.set(mine ? 0xfacc15 : 0x94a3b8);
        placeLabel(o.spec.name, o.model.getWorldPosition(worldPos), mine || chosen === o.spec.body);
      }
      for (const l of landers) placeLabel(l.spec.name, l.pin.getWorldPosition(worldPos), chosenCraft === l.spec.name || chosen === l.spec.body);
      const chosenKey = chosenCraft && !CRAFT_BODY[chosenCraft] ? chosenCraft : chosen;
      if (chosenKey !== lastChosen) {
        lastChosen = chosenKey;
        follow = chosenKey;
        fly = 70;
        const size = PLANETS.find((p) => p.name === chosen)?.size ?? 0.05;
        flyDistance = chosen === "Sun" ? 15 : chosen === "Moon" ? 1.2 : THREE.MathUtils.clamp(size * 18, 1, 6);
      }
      const missionPos = chosenCraft ? craft.find((c) => c.mission.key === chosenCraft)?.mesh.position : undefined;
      const chosenPos = missionPos ?? (chosen === "Sun" ? new THREE.Vector3() : chosen === "Moon" ? moonMesh.position : bodies.find((b) => b.planet.name === chosen)?.mesh.position);
      // The selection ring is for finding a body from afar; once the camera has flown in, it would only hide the planet.
      ring.visible = Boolean(chosenPos) && camera.position.distanceTo(chosenPos!) > flyDistance * 1.4;
      if (chosenPos) {
        ring.position.copy(chosenPos);
        ring.scale.setScalar(chosen === "Sun" ? 3.2 : chosen === "Moon" ? 0.6 : Math.max(0.6, (bodies.find((b) => b.planet.name === chosen)?.planet.size ?? 0.1) * 6));
        ring.quaternion.copy(camera.quaternion);
      }
      if (follow && chosenPos) {
        const offset = camera.position.clone().sub(controls.target);
        controls.target.lerp(chosenPos, fly > 0 ? 0.08 : 1);
        if (fly > 0) {
          offset.setLength(THREE.MathUtils.lerp(offset.length(), flyDistance, 0.08));
          fly -= 1;
        }
        camera.position.copy(controls.target).add(offset);
      }
      craft.forEach(({ mission, mesh }) => {
        mesh.rotation.y += 0.01;
        mesh.scale.setScalar(focusRef.current === mission.key || chosenCraft === mission.key ? 0.12 : 0.07);
        placeLabel(mission.key, mesh.position);
      });

      // Resolve each active DSN downlink (one per spacecraft) to the spacecraft's position in the scene.
      const seen = new Set<string>();
      const targets: THREE.Vector3[] = [];
      for (const link of linksRef.current) {
        if (targets.length >= MAX_LINKS || seen.has(link.code)) continue;
        seen.add(link.code);
        const orbiter = orbiters.find((o) => o.spec.code === link.code);
        const lander = landers.find((l) => l.spec.code === link.code);
        const body = AT_BODY[link.code];
        const key = CODE_ALIAS[link.code];
        const pos = orbiter
          ? orbiter.model.getWorldPosition(new THREE.Vector3())
          : lander
            ? lander.pin.getWorldPosition(new THREE.Vector3())
            : body === "Moon"
              ? moonMesh.position
              : body
                ? bodies.find((b) => b.planet.name === body)?.mesh.position
                : craft.find((c) => c.mission.key === key)?.mesh.position;
        if (pos && body !== "Earth" && pos.distanceTo(earth.mesh.position) > 0.05) targets.push(pos);
      }
      const ctrl = new THREE.Vector3();
      const point = new THREE.Vector3();
      arcs.forEach((arc, k) => {
        const target = targets[k];
        arc.line.visible = Boolean(target);
        arc.dots.forEach((d) => (d.visible = Boolean(target)));
        if (!target) return;
        const span = target.distanceTo(earth.mesh.position);
        ctrl.copy(target).add(earth.mesh.position).multiplyScalar(0.5);
        ctrl.y += span * (0.18 + 0.06 * (k % 4));
        for (let i = 0; i < ARC_POINTS; i++) {
          bezier(target, ctrl, earth.mesh.position, i / (ARC_POINTS - 1), point);
          arc.positions.set([point.x, point.y, point.z], i * 3);
        }
        arc.geometry.attributes.position.needsUpdate = true;
        arc.dots.forEach((dot, i) => bezier(target, ctrl, earth.mesh.position, (now / 3000 + i / 3 + k * 0.13) % 1, dot.position));
      });

      glow.scale.setScalar(1 + 0.05 * Math.sin(now / 600));
      sunSprite.material.rotation = 0;
      if (now - labelAt > 500) {
        labelAt = now;
        setDateLabel(new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 16).replace("T", " ") + " UTC");
      }
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener("pointerdown", engage);
      host.removeEventListener("pointerleave", disengage);
      host.removeEventListener("wheel", gateWheel, { capture: true });
      host.removeEventListener("pointerdown", onDown);
      host.removeEventListener("pointerup", onUp);
      apiRef.current = null;
      controls.dispose();
      owned.forEach((item) => item.dispose());
      sunTexture?.dispose();
      setSunTextureRef.current = () => undefined;
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [missions]);

  const missionName = (key: string) => missions.find((m) => m.key === key)?.name ?? key;

  return (
    <section aria-labelledby="solar-title" className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-center justify-between">
        <p id="solar-title" className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-sky-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" aria-hidden="true" />
          Solar system · live
        </p>
      </div>
      <div ref={frameRef} className={`relative mt-3 overflow-hidden ${full ? "h-screen w-screen" : "aspect-square rounded-md border border-slate-800"} bg-[radial-gradient(circle_at_50%_50%,#0b1a2a_0%,#020617_70%)]`}>
        <div ref={hostRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" role="img" aria-label="3D solar system with planets at today's positions, deep-space missions and active Deep Space Network links" />
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {labelNames.map((key) => (
            <span
              key={key}
              ref={(el) => {
                labelRefs.current[key] = el;
              }}
              className={`absolute left-0 top-0 whitespace-nowrap font-mono ${CRAFT_BODY[key] ? "text-[9px] text-amber-300" : MOON_PARENT[key] && key !== "Moon" ? "text-[9px] text-slate-400" : "text-[11px]"} ${key === selected ? "font-semibold text-sky-300" : BODY_ORDER.includes(key) ? "text-slate-300" : "text-slate-500"}`}
            >
              {BODY_ORDER.includes(key) ? key : missionName(key)}
            </span>
          ))}
        </div>
        {selectedCraft && <CraftCard name={selectedCraft} missionName={missionName} links={links} onClose={() => setSelectedCraft(null)} />}
        <div className="pointer-events-none absolute bottom-7 right-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-emerald-300">
          ━ ● live DSN downlink: spacecraft → Earth
        </div>
        <ZoomControls onZoomIn={() => apiRef.current?.zoom(0.75)} onZoomOut={() => apiRef.current?.zoom(1 / 0.75)} onReset={() => apiRef.current?.reset()} full={full} onFullscreen={toggle} />
        <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-slate-300">{dateLabel}</span>
        <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-amber-200">
          Sun: {SUN_VIEWS.find((v) => v.id === sunView)?.label} · {ageText(sunImage.observed, clock)}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="inline-flex border border-slate-700 p-0.5" aria-label="Time speed">
          {SPEEDS.map((s, i) => (
            <button key={s.label} type="button" aria-pressed={speed === i} onClick={() => setSpeed(i)} className={`px-1.5 py-0.5 font-mono text-[9px] ${speed === i ? "bg-sky-300 text-slate-950" : "text-slate-300 hover:text-white"}`}>
              {s.label}
            </button>
          ))}
        </div>
        <span className="text-[9px] text-slate-500">√ distance scale · rings 1 / 10 / 100 au</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1" aria-label="Open a body's intel">
        <span className="mr-1 font-mono text-[9px] uppercase tracking-widest text-slate-500">Click a body or</span>
        {BODY_ORDER.map((name) => {
          const on = links.some((l) => BODY_CODES(name).has(l.code));
          return (
            <button
              key={name}
              type="button"
              aria-pressed={selected === name}
              onClick={() => {
                setSelectedCraft(null);
                setSelected((current) => (current === name ? null : name));
              }}
              className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] ${selected === name ? "border-sky-300 text-sky-200" : "border-slate-700 text-slate-400 hover:text-slate-200"}`}
            >
              {on && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="a spacecraft here is on the DSN now" />}
              {name}
            </button>
          );
        })}
      </div>
      {selected && !compact && <BodyIntel key={selected} body={selected} links={links} distanceAu={distanceFromEarth(selected)} onClose={() => setSelected(null)} />}

      {compact ? (
        <a href="/work/network-concept#orbit-title" className="mt-3 block text-right text-xs font-medium text-sky-300 hover:text-sky-200">Open each body&apos;s intel, the DSN and our path through the galaxy &rarr;</a>
      ) : (
        <>
      <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-emerald-300">Deep Space Network · now</p>
      <ul className="mt-1 max-h-56 space-y-1 overflow-y-auto text-[11px]">
        {links.length === 0 && <li className="text-slate-500">Loading DSN status…</li>}
        {links.map((link) => {
          const key = CODE_ALIAS[link.code];
          return (
            <li key={`${link.dish}-${link.code}`}>
              <button
                type="button"
                onMouseEnter={() => setFocus(key ?? null)}
                onMouseLeave={() => setFocus(null)}
                className="flex w-full items-baseline justify-between gap-2 text-left hover:text-white"
              >
                <span className="truncate text-slate-300">
                  {link.name}
                  <span className="text-slate-500"> · {link.station} {link.dish}</span>
                </span>
                <span className="shrink-0 font-mono text-[10px] text-slate-400">{link.band} {link.downRate ? rate(link.downRate) : "carrier"}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
        Green arcs with moving dots: data flowing from each spacecraft a DSN antenna is receiving right now down to Earth (Goldstone, Madrid, Canberra; refreshed every 30 s). Yellow models: human spacecraft — click one to see its orbit. The Sun shows the same live image as the Sun panel (enlarged). Planets: JPL approximate elements; surface maps by Solar System Scope (CC BY 4.0, from NASA mission data), Pluto map NASA/JHUAPL/SwRI (New Horizons). Missions: JPL Horizons, positions for today. Data: NASA/JPL.
      </p>
      <GalaxyInset />
        </>
      )}
    </section>
  );
}
