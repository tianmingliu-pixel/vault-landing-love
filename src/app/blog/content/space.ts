import type { Post } from "../posts-types";

export const space: Post = {
  slug: "reading-the-sky-with-open-data",
  focus: null,
  title: "Reading the Sky with Open Data",
  subtitle: "How this site watches the Sun, 14,000 satellites and the Deep Space Network live — using nothing but public feeds.",
  date: "2026-10-03",
  minutes: 12,
  accent: "#fbbf24",
  motif: "sky",
  kit: {
    name: "Live Space Console",
    tagline: "The source and data playbook behind this site's live Sun, satellites and solar system.",
    includes: [
      "Typed fetchers for NOAA SWPC, NASA DSN Now, EPIC, Helioviewer and CelesTrak",
      "Satellite propagation with satellite.js (SGP4) from CelesTrak OMM data",
      "Alert rules for geomagnetic storms and radio blackouts, with the physics behind them",
      "Caching and failure-handling patterns for feeds that go stale",
    ],
  },
  sections: [
    {
      id: "what-is-public",
      access: "anonymous",
      title: "More of space is public than you think",
      teaser: "",
      blocks: [
        { kind: "p", text: "Every number on this site's Live Earth & Space dashboard comes from a public, documented feed. Government space agencies publish operational data because forecasters, airlines, power grids and satellite operators depend on it — and because taxpayers paid for it." },
        { kind: "diagram", name: "space-data-path", caption: "From instrument to your browser: a satellite or probe sends data to a ground antenna, the agency processes and publishes it, and this site's server fetches, caches and trims it." },
        {
          kind: "table",
          head: ["What you see", "Source", "How fresh"],
          rows: [
            ["The Sun in extreme ultraviolet", "NOAA GOES-19 SUVI", "~4 minutes"],
            ["Sun's magnetic field, sunspots", "NASA SDO via Helioviewer", "1–4 hours"],
            ["Flares, Kp, solar wind", "NOAA Space Weather Prediction Center", "1–5 minutes"],
            ["Whole Earth from 1.5 million km", "NASA EPIC on NOAA DSCOVR", "1–5 days"],
            ["Which deep-space probes are talking", "NASA Deep Space Network Now", "5 seconds"],
            ["Where 14,000+ satellites are", "CelesTrak orbital elements", "Several times a day"],
          ],
        },
        { kind: "image", src: "https://images-assets.nasa.gov/image/PIA26350/PIA26350~medium.jpg", alt: "Jupiter seen by the JunoCam imager on NASA's Juno spacecraft during its 62nd close flyby, June 13, 2024", credit: "Image data: NASA/JPL-Caltech/SwRI/MSSS · Image processing: Jackie Branc (CC BY) — PIA26350, processed from public raw JunoCam data" },
        { kind: "video", id: "XDCg6ROAOEY", title: "A Day in the Life of the Deep Space Network", by: "Joseph Lazio, NASA JPL · von Kármán lecture", note: "How three antenna complexes, 120° apart, keep in touch with more than 30 missions." },
        {
          kind: "resources",
          items: [
            { title: "Space Weather Prediction Center data", by: "NOAA", url: "https://services.swpc.noaa.gov/", kind: "doc", note: "The JSON and text products behind every chart on the Sun panel." },
            { title: "Deep Space Network Now", by: "NASA JPL", url: "https://eyes.nasa.gov/apps/dsn-now/", kind: "tool", note: "The live view this site's DSN arcs are built from." },
            { title: "EPIC — Earth Polychromatic Imaging Camera", by: "NASA GSFC", url: "https://epic.gsfc.nasa.gov/", kind: "doc", note: "Daily full-disk Earth images and their API." },
            { title: "CelesTrak", by: "T.S. Kelso", url: "https://celestrak.org/", kind: "doc", note: "The public source of satellite orbital elements since 1985." },
            { title: "Helioviewer", by: "ESA & NASA", url: "https://helioviewer.org/", kind: "tool", note: "Browse SDO and SOHO solar imagery at any date." },
          ],
        },
        { kind: "callout", tone: "info", text: "Try it: the Live Earth & Space section on the home page and the full Network Concept lab show all of this running in real time." },
      ],
    },
    {
      id: "reading",
      access: "member",
      title: "How to read what you're seeing",
      teaser: "Flare classes, Kp, Bz, light-time and downlink delay — the five numbers that explain most space-weather news.",
      blocks: [
        {
          kind: "table",
          head: ["Number", "What it means", "When to pay attention"],
          rows: [
            ["X-ray class (A, B, C, M, X)", "Peak 0.1–0.8 nm X-ray flux; each letter is 10× the last", "M1+ → HF radio blackouts on Earth's day side"],
            ["Kp (0–9)", "Global geomagnetic disturbance, 3-hour index", "Kp ≥ 5 is a storm: more satellite drag, GNSS errors, aurora"],
            ["Bz (nT)", "North–south part of the solar wind's magnetic field", "Strongly negative (< −10 nT) lets energy into the magnetosphere"],
            ["Solar wind speed", "Plasma speed at L1, typically 300–800 km/s", "> 600 km/s plus negative Bz → storm likely within hours"],
            ["≥10 MeV protons (pfu)", "Energetic particles from flares and CMEs", "> 10 pfu is an S1 radiation storm: satellite upsets, polar radio absorption"],
          ],
        },
        { kind: "h", text: "Why everything from Mars arrives late" },
        { kind: "p", text: "Light takes between about 3 and 22 minutes to cross from Mars to Earth depending on where the planets are. But the raw images from Perseverance and Curiosity typically reach Earth two to four hours after they're taken: the rover first has to wait for a relay orbiter overhead, that orbiter has to wait for a Deep Space Network pass, and only then does JPL process and publish them. The planet panels on this site measure that gap from each image's taken and received timestamps." },
        { kind: "callout", tone: "info", text: "In February 2022 a moderate geomagnetic storm raised atmospheric drag enough that 38 of 49 newly launched Starlink satellites re-entered — the clearest recent example of space weather costing real money." },
      ],
    },
    {
      id: "lab",
      access: "platinum",
      title: "Lab: build your own live space console",
      teaser: "Fetch, cache and alert on live space weather, propagate satellites from CelesTrak data, and parse the DSN feed.",
      blocks: [
        {
          kind: "code",
          lang: "ts",
          title: "space-weather.ts — fetch, trim, alert",
          text: `const SWPC = "https://services.swpc.noaa.gov/";
type Wind = { time_tag: string; speed: number; dsflag: number };
type Mag = { time_tag: string; gsm_bz: number; dsflag: number };

export async function stormRisk() {
  const [wind, mag] = await Promise.all([
    fetch(SWPC + "json/ace/swepam/ace_swepam_1h.json", { next: { revalidate: 300 } }).then((r) => r.json() as Promise<Wind[]>),
    fetch(SWPC + "json/ace/mag/ace_mag_1h.json", { next: { revalidate: 300 } }).then((r) => r.json() as Promise<Mag[]>),
  ]);
  const v = wind.find((w) => w.dsflag === 0 && w.speed > 0)?.speed ?? 0;   // newest first
  const bz = mag.find((m) => m.dsflag === 0 && m.gsm_bz > -9000)?.gsm_bz ?? 0;
  // Coupling proxy: fast wind with a southward field drives storms.
  const risk = v > 600 && bz < -10 ? "high" : v > 500 && bz < -5 ? "elevated" : "quiet";
  return { speed: v, bz, risk };
}`,
        },
        {
          kind: "code",
          lang: "ts",
          title: "satellites.ts — where is a satellite right now?",
          text: `import { json2satrec, propagate, gstime, eciToGeodetic, degreesLat, degreesLong } from "satellite.js";

const omm = await fetch("https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=json").then((r) => r.json());
const satrec = json2satrec(omm[0]);                 // ISS
const now = new Date();
const { position } = propagate(satrec, now);         // TEME km
if (position && typeof position !== "boolean") {
  const geo = eciToGeodetic(position, gstime(now));
  console.log(degreesLat(geo.latitude), degreesLong(geo.longitude), geo.height, "km");
}`,
        },
        {
          kind: "code",
          lang: "ts",
          title: "dsn.ts — who is the DSN talking to?",
          text: `const xml = await fetch("https://eyes.nasa.gov/dsn/data/dsn.xml").then((r) => r.text());
const doc = new DOMParser().parseFromString(xml, "text/xml");
const links = [...doc.querySelectorAll("dish")].flatMap((dish) =>
  [...dish.querySelectorAll("downSignal[active='true']")].map((s) => ({
    dish: dish.getAttribute("name"),
    spacecraft: s.getAttribute("spacecraft"),
    band: s.getAttribute("band"),
    rateBps: Number(s.getAttribute("dataRate")),
    powerDbm: Number(s.getAttribute("power")),          // e.g. −160 dBm from New Horizons
    rangeKm: Number(dish.querySelector(\`target[name="\${s.getAttribute("spacecraft")}"]\`)?.getAttribute("downlegRange")),
  })),
);`,
        },
        { kind: "h", text: "Operating it reliably" },
        { kind: "list", items: ["Cache on the server (5 min for space weather, 6 h for ephemerides) — never hammer an agency API from every browser.", "Treat sentinel values (−9999.9, −1) as missing, not as data.", "Keep the last good value and show its age when a feed stalls; some feeds silently stop updating.", "Respect each provider's usage notes; CelesTrak in particular asks clients to fetch no more than necessary."] },
      ],
    },
  ],
};
