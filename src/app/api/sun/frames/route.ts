// The frame sequence behind each Sun view, so the panel can play the Sun as it actually moved instead of one still.
//   span=3h  — SUVI: every 4-minute image of the last 3 h; SDO: Helioviewer frames 15 min apart; LASCO: NOAA's last 6 h
//   span=30d — one frame per day for 30 days from the Helioviewer archive (SUVI bands use the matching SDO/AIA band,
//              since NOAA keeps only about a day of SUVI images), ending on the newest frame

// Each entry points at /api/sun/frame, which fetches and shrinks one frame and lets it be cached for good.

const SUVI_BANDS = ["094", "131", "171", "195", "284", "304"];
const HV_SOURCES: Record<string, number> = { HMIMAG: 19, HMIINT: 18, AIA193: 11, AIA171: 10, AIA304: 13, AIA131: 9, LASCOC3: 5 };
/** Which Helioviewer layer stands in for each view over 30 days. */
const MONTH_LAYER: Record<string, string> = { SUVI195: "AIA193", SUVI304: "AIA304", SUVI131: "AIA131", SUVI171: "AIA171", HMIMAG: "HMIMAG", HMIINT: "HMIINT", AIA193: "AIA193", C3: "LASCOC3", C2: "LASCOC3" };
const LASCO_DIRS: Record<string, string> = { C2: "lasco-c2", C3: "lasco-c3" };

type Frame = { t: string; src: string };

const iso = (t: string) => `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(9, 11)}:${t.slice(11, 13)}:${t.slice(13, 15)}Z`;

async function suvi(band: string, hours: number): Promise<Frame[]> {
  const listing = await fetch(`https://services.swpc.noaa.gov/images/animations/suvi/primary/${band}/`, { next: { revalidate: 120 } }).then((r) => r.text());
  const files = [...listing.matchAll(/href="(or_suvi-[^"]+_s(\d{8}T\d{6})Z[^"]*\.png)"/g)].map((m) => ({ file: m[1], t: iso(m[2]) }));
  if (!files.length) return [];
  const end = Date.parse(files.at(-1)!.t);
  const recent = files.filter((f) => Date.parse(f.t) >= end - hours * 3_600_000);
  const step = hours > 3 ? 8 : 1;
  // Step back from the newest frame so the sequence always ends on the latest image.
  const picked = recent.filter((_, i) => (recent.length - 1 - i) % step === 0);
  const frames = picked.map((f) => ({ t: f.t, src: `/api/sun/frame?s=suvi&k=${band}&f=${encodeURIComponent(f.file)}` }));
  // NOAA's directory listing sometimes stops growing for an hour or more while latest.png keeps updating:
  // if latest.png is newer than the last listed frame, end the movie on it.
  const head = await fetch(`https://services.swpc.noaa.gov/images/animations/suvi/primary/${band}/latest.png`, { method: "HEAD", next: { revalidate: 120 } }).catch(() => null);
  const modified = head?.headers.get("last-modified");
  if (modified && Date.parse(modified) - end > 10 * 60_000) {
    const at = new Date(modified).toISOString().slice(0, 19) + "Z";
    frames.push({ t: at, src: `/api/sun/frame?s=suvi&k=${band}&f=latest.png&at=${at}` });
  }
  return frames;
}

async function helioviewer(key: string, hours: number): Promise<Frame[]> {
  const now = new Date().toISOString().slice(0, 19) + "Z";
  const closest = await fetch(`https://api.helioviewer.org/v2/getClosestImage/?date=${now}&sourceId=${HV_SOURCES[key]}`, { next: { revalidate: 600 } }).then(
    (r) => r.json() as Promise<{ date?: string }>,
  );
  if (!closest.date) return [];
  const latest = Date.parse(closest.date.replace(" ", "T") + "Z");
  // Hour-aligned steps (plus the newest image) so the same URLs repeat between visitors and stay cached.
  const hour = 3_600_000;
  const steps = hours > 3 ? 24 : 12;
  const size = hours > 3 ? hour : hour / 4;
  const first = Math.floor(latest / size) * size;
  const times = Array.from({ length: steps }, (_, i) => first - (steps - 1 - i) * size);
  if (times.at(-1)! < latest - 60_000) times.push(latest);
  return times.map((ms) => {
    const t = new Date(ms).toISOString().slice(0, 19) + "Z";
    return { t, src: `/api/sun/frame?s=hv&k=${key}&f=${t}` };
  });
}

async function lasco(key: string, hours: number): Promise<Frame[]> {
  const dir = LASCO_DIRS[key];
  const listing = await fetch(`https://services.swpc.noaa.gov/images/animations/${dir}/`, { next: { revalidate: 300 } }).then((r) => r.text());
  const files = [...listing.matchAll(/href="((\d{8})_(\d{4})_c[23]_512\.jpg)"/g)].map((m) => ({
    file: m[1],
    t: `${m[2].slice(0, 4)}-${m[2].slice(4, 6)}-${m[2].slice(6, 8)}T${m[3].slice(0, 2)}:${m[3].slice(2, 4)}:00Z`,
  }));
  if (!files.length) return [];
  const end = Date.parse(files.at(-1)!.t);
  return files.filter((f) => Date.parse(f.t) >= end - hours * 3_600_000).map((f) => ({ t: f.t, src: `/api/sun/frame?s=lasco&k=${key}&f=${f.file}` }));
}

async function month(view: string): Promise<Frame[]> {
  const key = MONTH_LAYER[view];
  if (!key) return [];
  const now = new Date().toISOString().slice(0, 19) + "Z";
  const closest = await fetch(`https://api.helioviewer.org/v2/getClosestImage/?date=${now}&sourceId=${HV_SOURCES[key]}`, { next: { revalidate: 600 } }).then(
    (r) => r.json() as Promise<{ date?: string }>,
  );
  if (!closest.date) return [];
  const latest = Date.parse(closest.date.replace(" ", "T") + "Z");
  // Daily frames at a fixed hour (so the URLs, and their cached images, stay the same from one visit to the next).
  const day = 86_400_000;
  const anchor = Math.floor(latest / day) * day;
  const times = Array.from({ length: 30 }, (_, i) => anchor - (29 - i) * day);
  if (latest - times.at(-1)! > 3_600_000) times.push(latest);
  return times.map((ms) => {
    const t = new Date(ms).toISOString().slice(0, 19) + "Z";
    return { t, src: `/api/sun/frame?s=hv&k=${key}&f=${t}` };
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const view = params.get("view") ?? "";
  const span = params.get("span") === "30d" ? "30d" : "3h";
  const hours = 3;
  try {
    let frames: Frame[] | null = null;
    if (span === "30d") frames = view in MONTH_LAYER ? await month(view) : null;
    else if (view.startsWith("SUVI") && SUVI_BANDS.includes(view.slice(4))) frames = await suvi(view.slice(4), hours);
    else if (view in HV_SOURCES) frames = await helioviewer(view, hours);
    else if (view in LASCO_DIRS) frames = await lasco(view, 6);
    if (!frames) return Response.json({ error: "unknown view" }, { status: 400 });
    return Response.json({ view, span, frames }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } });
  } catch {
    return Response.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
