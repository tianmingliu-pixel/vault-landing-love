// Heliocentric positions of deep-space missions from NASA/JPL Horizons, fetched one by one
// (Horizons throttles parallel requests) and cached for six hours.
export const revalidate = 21600;

const MISSIONS = [
  { id: "-31", key: "VGR1", name: "Voyager 1" },
  { id: "-32", key: "VGR2", name: "Voyager 2" },
  { id: "-98", key: "NHPC", name: "New Horizons" },
  { id: "-96", key: "SPP", name: "Parker Solar Probe" },
  { id: "-61", key: "JNO", name: "Juno" },
  { id: "-159", key: "EURC", name: "Europa Clipper" },
  { id: "-28", key: "JUICE", name: "JUICE" },
  { id: "-121", key: "BEPI", name: "BepiColombo" },
  { id: "-255", key: "PSYC", name: "Psyche" },
  { id: "-49", key: "LUCY", name: "Lucy" },
  { id: "-64", key: "ORX", name: "OSIRIS-APEX" },
  { id: "-170", key: "JWST", name: "James Webb Space Telescope" },
] as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET() {
  const day = new Date().toISOString().slice(0, 10);
  const next = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const out: { key: string; name: string; x: number; y: number; z: number }[] = [];
  for (const mission of MISSIONS) {
    const url =
      `https://ssd.jpl.nasa.gov/api/horizons.api?format=json&COMMAND='${mission.id}'&EPHEM_TYPE=VECTORS&CENTER='500@10'` +
      `&START_TIME='${day}'&STOP_TIME='${next}'&STEP_SIZE='1d'&OUT_UNITS='AU-D'&VEC_TABLE='1'&CSV_FORMAT='YES'&REF_PLANE='ECLIPTIC'`;
    try {
      const response = await fetch(url, { next: { revalidate: 21600 } });
      const json = (await response.json()) as { result?: string };
      const row = json.result?.match(/\$\$SOE\s*\n([^\n]+)/)?.[1]?.split(",").map((cell) => cell.trim());
      if (row && row.length >= 5) out.push({ key: mission.key, name: mission.name, x: Number(row[2]), y: Number(row[3]), z: Number(row[4]) });
    } catch {
      /* skip this mission */
    }
    await sleep(250);
  }
  return Response.json(
    { source: "NASA/JPL Horizons, heliocentric ecliptic J2000, au", date: day, missions: out },
    { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } },
  );
}
