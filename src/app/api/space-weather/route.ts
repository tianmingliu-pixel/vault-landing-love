// Read-only proxy for NOAA Space Weather Prediction Center products (some send no CORS headers, some are plain text).
// Only these fixed public endpoints are reachable; responses are cached for five minutes and trimmed to what the
// Sun panel draws: up to 30 days of history for every series NOAA publishes that far back.
export const revalidate = 300;

const SWPC = "https://services.swpc.noaa.gov/";
const PRODUCTS = {
  xray: "json/goes/primary/xrays-7-day.json", // GOES X-rays: NOAA keeps 7 days of 1-minute data
  protons: "json/goes/primary/integral-protons-7-day.json", // GOES protons: 7 days
  plasma: "json/ace/swepam/ace_swepam_1h.json", // ACE solar wind, hourly, ~27 days
  mag: "json/ace/mag/ace_mag_1h.json", // ACE magnetic field, hourly, ~27 days
  kp: "text/daily-geomagnetic-indices.txt", // planetary Kp, 3-hourly, 30 days
  daily: "text/daily-solar-indices.txt", // F10.7, sunspot number, flare counts per day, 30 days
  scales: "products/noaa-scales.json",
  alerts: "products/alerts.json",
  probabilities: "json/solar_probabilities.json",
  f107: "json/f107_cm_flux.json",
  sunspots: "json/solar-cycle/observed-solar-cycle-indices.json",
} as const;
type Kind = keyof typeof PRODUCTS;

type Row = Record<string, unknown>;
type Point = { t: string; v: number };

const DAY = 86_400_000;

/** The last `days` days in fixed bins; `peak` keeps each bin's maximum so flares and proton spikes survive. */
function bin(points: Point[], minutes: number, peak: boolean, days = 30): Point[] {
  const since = Date.now() - days * DAY;
  const size = minutes * 60_000;
  const bins = new Map<number, number[]>();
  for (const { t, v } of points) {
    const ms = Date.parse(t.endsWith("Z") ? t : t + "Z");
    if (!(ms >= since) || !Number.isFinite(v)) continue;
    const key = Math.floor(ms / size) * size;
    const list = bins.get(key);
    if (list) list.push(v);
    else bins.set(key, [v]);
  }
  return [...bins.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, values]) => ({ t: new Date(key).toISOString(), v: peak ? Math.max(...values) : values.reduce((sum, x) => sum + x, 0) / values.length }));
}

const dataLines = (text: string) => text.split("\n").filter((line) => /^\d{4} \d{2} \d{2}/.test(line));
const isoDay = (line: string) => `${line.slice(0, 4)}-${line.slice(5, 7)}-${line.slice(8, 10)}`;

function trim(kind: Kind, body: unknown): unknown {
  // Plain-text 30-day tables.
  if (typeof body === "string") {
    if (kind === "kp") {
      // Last eight columns are the planetary 3-hour Kp values (−1 = not yet available).
      return dataLines(body).flatMap((line) => {
        const kps = line.trim().split(/\s+/).slice(-8).map(Number);
        return kps.map((v, k) => ({ t: `${isoDay(line)}T${String(k * 3).padStart(2, "0")}:00:00Z`, v })).filter((p) => p.v >= 0);
      });
    }
    if (kind === "daily") {
      return dataLines(body).map((line) => {
        const cols = line.trim().split(/\s+/);
        // date(3) · 10.7 cm flux · sunspot number · area · new regions · mean field · X-ray bkgd · C M X · S 1 2 3
        return { t: `${isoDay(line)}T12:00:00Z`, f107: Number(cols[3]), ssn: Number(cols[4]), c: Number(cols[9]), m: Number(cols[10]), x: Number(cols[11]) };
      });
    }
    return null;
  }
  if (!Array.isArray(body)) return body;
  const rows = body as Row[];
  const clean = (v: unknown) => (typeof v === "number" && v > -9000 ? v : NaN);
  switch (kind) {
    // GOES long channel (0.1–0.8 nm), the one flare classes are defined on, as hourly peaks.
    case "xray":
      return bin(rows.filter((r) => r.energy === "0.1-0.8nm" && Number(r.flux) > 0).map((r) => ({ t: String(r.time_tag), v: Number(r.flux) })), 60, true);
    case "protons":
      return bin(rows.filter((r) => r.energy === ">=10 MeV" && Number(r.flux) > 0).map((r) => ({ t: String(r.time_tag), v: Number(r.flux) })), 60, true);
    case "plasma": {
      const good = rows.filter((r) => r.dsflag === 0);
      return {
        source: "ACE",
        speed: bin(good.map((r) => ({ t: String(r.time_tag), v: clean(r.speed) })), 60, false),
        density: bin(good.map((r) => ({ t: String(r.time_tag), v: clean(r.dens) })), 60, false),
      };
    }
    case "mag": {
      const good = rows.filter((r) => r.dsflag === 0);
      return { bz: bin(good.map((r) => ({ t: String(r.time_tag), v: clean(r.gsm_bz) })), 60, false), bt: bin(good.map((r) => ({ t: String(r.time_tag), v: clean(r.bt) })), 60, false) };
    }
    // Newest alerts, warnings and watches: the headline of each.
    case "alerts":
      return rows.slice(0, 12).map((row) => {
        const lines = String(row.message ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const headline = lines.find((line) => /^(ALERT|WARNING|WATCH|SUMMARY|CONTINUED ALERT|EXTENDED WARNING|CANCEL)/.test(line)) ?? lines[2] ?? "";
        return { id: row.product_id, t: row.issue_datetime, headline };
      });
    case "probabilities":
    case "f107":
      return rows[0] ?? null;
    case "sunspots":
      return rows.slice(-13);
    default:
      return body;
  }
}

export async function GET(request: Request) {
  const kind = new URL(request.url).searchParams.get("kind") as Kind | null;
  if (!kind || !(kind in PRODUCTS)) return Response.json({ error: "bad request" }, { status: 400 });
  try {
    const upstream = await fetch(SWPC + PRODUCTS[kind], { next: { revalidate: 300 } });
    if (!upstream.ok) return Response.json({ error: `upstream ${upstream.status}` }, { status: 502 });
    const raw = PRODUCTS[kind].endsWith(".txt") ? await upstream.text() : await upstream.json();
    return Response.json(trim(kind, raw), { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
  } catch {
    return Response.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
