// internet-atlas.ts — physics of the path and engineering principles for the Network Concept page.

const EARTH_RADIUS_KM = 6371;
// Light in silica fibre travels at c / n, with group index n ≈ 1.468 → about 204,000 km/s.
const FIBER_KM_PER_MS = 299_792.458 / 1.468 / 1000;

export type LatLon = { lat: number; lon: number };

export function greatCircleKm(a: LatLon, b: LatLon) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Theoretical round-trip floor over fibre along the great circle; real cables are longer and add equipment delay. */
export function minRttMs(km: number) {
  return (2 * km) / FIBER_KM_PER_MS;
}

// Countries with no coastline reach submarine cables only through a neighbour's landing stations.
export const landlockedCountries = [
  "Afghanistan", "Andorra", "Armenia", "Austria", "Belarus", "Bhutan", "Bolivia", "Botswana", "Burkina Faso", "Burundi",
  "Central African Republic", "Chad", "Czechia", "Eswatini", "Ethiopia", "Hungary", "Kosovo", "Kyrgyzstan", "Laos", "Lesotho",
  "Kazakhstan", "Liechtenstein", "Luxembourg", "Malawi", "Mali", "Moldova", "Mongolia", "Nepal", "Niger", "North Macedonia", "Paraguay",
  "Rwanda", "San Marino", "Serbia", "Slovakia", "South Sudan", "Switzerland", "Tajikistan", "Turkmenistan", "Uganda", "Uzbekistan",
  "Vatican City", "Zambia", "Zimbabwe",
] as const;

export const engineeringNotes = [
  {
    tag: "01 / ROUTING",
    title: "BGP is a trust protocol",
    body: "Networks announce which address blocks they can reach, and neighbours largely believe them. Route leaks and hijacks exploit exactly that. RPKI route-origin validation lets networks reject announcements whose origin does not match a cryptographically signed authorization — but it only protects networks that actually enforce it.",
  },
  {
    tag: "02 / ANYCAST",
    title: "One address, many places",
    body: "DNS root servers and CDNs announce the same prefix from many sites at once. BGP then delivers each user to a topologically nearby instance, which cuts latency and spreads denial-of-service traffic across the whole footprint instead of one target.",
  },
  {
    tag: "03 / PHYSICS",
    title: "Light sets the floor",
    body: "Signals in fibre travel at roughly two-thirds of the speed of light in vacuum. No protocol can beat that. The round-trip figures below are theoretical minimums along the great circle; real cables follow coastlines and add amplifier and switching delay.",
  },
  {
    tag: "04 / RESILIENCE",
    title: "Few cables, single points of failure",
    body: "Countries served by one or two systems can lose most international capacity when a single cable is cut by an anchor or earthquake. Path diversity — several cables, several landing stations, several routes — is what turns a fragile link into infrastructure.",
  },
] as const;
