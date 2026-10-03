// What the open spacecraft fleet is sending back about one body of the solar system, gathered into one shape:
//   imagery.now / imagery.before — the newest images and the set one day (or one sol) earlier, each with the time it
//   was taken and, where the mission publishes it, the time it reached Earth (so the downlink delay is visible)
//   weather — surface weather where a lander reports it (Curiosity REMS)
//   moon — NASA SVS Dial-a-Moon geometry now and 24 h ago
//   archive — the newest NASA Image and Video Library images and videos about the body
// All sources are public, read-only and cached server-side.

type Item = { t: string; received?: string; src: string; full?: string; title: string; by: string };
type Video = { t: string; title: string; thumb: string; mp4: string; page: string };

const BODIES: Record<string, { query: string[]; match: RegExp }> = {
  Sun: { query: ["Sun", "Solar Dynamics Observatory", "Parker Solar Probe"], match: /\b(sun|solar|corona|SDO|Parker)\b/i },
  Mercury: { query: ["Mercury", "BepiColombo"], match: /\b(Mercury|BepiColombo|MESSENGER)\b/ },
  Venus: { query: ["Venus"], match: /\bVenus\b/i },
  Earth: { query: ["Earth", "EPIC DSCOVR"], match: /\b(Earth|EPIC|DSCOVR|blue marble)\b/i },
  Moon: { query: ["Moon", "Lunar Reconnaissance Orbiter"], match: /\b(Moon|lunar|Artemis|LRO)\b/i },
  Mars: { query: ["Mars", "Perseverance", "Mars Reconnaissance Orbiter"], match: /\b(Mars|Martian|Perseverance|Curiosity)\b/i },
  Jupiter: { query: ["Jupiter", "JunoCam"], match: /\b(Jupiter|Jovian|Juno|Europa|Io|Ganymede|Callisto)\b/ },
  Saturn: { query: ["Saturn", "Cassini"], match: /\b(Saturn|Cassini|Titan|Enceladus)\b/ },
  Uranus: { query: ["Uranus"], match: /\bUranus\b/i },
  Neptune: { query: ["Neptune"], match: /\b(Neptune|Triton)\b/ },
  Pluto: { query: ["Pluto", "New Horizons"], match: /\b(Pluto|New Horizons|Charon|Arrokoth)\b/ },
};

const json = <T,>(url: string, revalidate: number) =>
  fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (open-data research page)" }, next: { revalidate } }).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.json() as Promise<T>;
  });
const https = (url: string) => url.replace(/^http:\/\//, "https://");
const settle = async <T,>(promise: Promise<T>): Promise<T | null> => promise.catch(() => null);

/* ---------- Mars: Perseverance and Curiosity raw images, Curiosity weather ---------- */

type M2020Image = { sol: number; imageid: string; camera: { instrument: string }; title: string; date_taken_utc: string; date_received: string; sample_type: string; image_files: { medium?: string; small?: string; large?: string; full_res?: string } };
type MslImage = { sol: number; instrument: string; title: string; date_taken: string; date_received: string; https_url: string; is_thumbnail: boolean; extended?: { sample_type?: string } };

/** Newest sol and the sol before it, a spread of cameras from each. */
function bySol<T extends { sol: number }>(items: T[], camera: (item: T) => string, take = 8) {
  const sols = [...new Set(items.map((i) => i.sol))].sort((a, b) => b - a);
  const pick = (sol: number | undefined) => {
    if (sol === undefined) return [];
    const seen = new Map<string, number>();
    return items.filter((item) => {
      if (item.sol !== sol) return false;
      const n = seen.get(camera(item)) ?? 0;
      seen.set(camera(item), n + 1);
      return n < 2;
    }).slice(0, take);
  };
  return { latest: sols[0], previous: sols[1], now: pick(sols[0]), before: pick(sols[1]) };
}

async function mars() {
  const [m2020, msl, weather] = await Promise.all([
    settle(json<{ images: M2020Image[] }>("https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020&feedtype=json&num=100&page=0&order=sol+desc", 1800)),
    settle(json<{ items: MslImage[] }>("https://mars.nasa.gov/api/v1/raw_image_items/?order=sol%20desc&per_page=100&page=0&condition_1=msl:mission", 1800)),
    settle(json<{ soles: Record<string, string>[] }>("https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json", 3600)),
  ]);
  const perseverance = bySol((m2020?.images ?? []).filter((i) => i.sample_type === "Full"), (i) => i.camera.instrument);
  const curiosity = bySol((msl?.items ?? []).filter((i) => !i.is_thumbnail && i.extended?.sample_type !== "thumbnail"), (i) => i.instrument);
  const fromM2020 = (i: M2020Image): Item => ({
    t: i.date_taken_utc.endsWith("Z") ? i.date_taken_utc : i.date_taken_utc + "Z",
    received: i.date_received ? (i.date_received.endsWith("Z") ? i.date_received : i.date_received + "Z") : undefined,
    src: i.image_files.medium ?? i.image_files.small ?? "",
    full: i.image_files.full_res,
    title: `Sol ${i.sol} · ${i.camera.instrument.replaceAll("_", " ")}`,
    by: "Perseverance",
  });
  const fromMsl = (i: MslImage): Item => ({ t: i.date_taken, received: i.date_received, src: i.https_url, full: i.https_url, title: `Sol ${i.sol} · ${i.instrument.replaceAll("_", " ")}`, by: "Curiosity" });
  return {
    imagery: {
      now: [...perseverance.now.map(fromM2020), ...curiosity.now.map(fromMsl)],
      before: [...perseverance.before.map(fromM2020), ...curiosity.before.map(fromMsl)],
      nowLabel: `Newest sols · Perseverance ${perseverance.latest ?? "—"} · Curiosity ${curiosity.latest ?? "—"}`,
      beforeLabel: `One sol earlier · Perseverance ${perseverance.previous ?? "—"} · Curiosity ${curiosity.previous ?? "—"}`,
      note: "Raw images as they come down: Mars → relay orbiter (MRO, MAVEN, Odyssey, TGO) → Deep Space Network → JPL. The gap between taken and received is that relay chain plus the one-way light time.",
    },
    weather: (weather?.soles ?? []).slice(0, 7).map((s) => ({
      sol: s.sol, date: s.terrestrial_date, min: s.min_temp, max: s.max_temp, pressure: s.pressure, ground_min: s.min_gts_temp, ground_max: s.max_gts_temp, uv: s.local_uv_irradiance_index, opacity: s.atmo_opacity, ls: s.ls,
    })),
  };
}

/* ---------- Earth: DSCOVR EPIC full-disk images from L1 ---------- */

type Epic = { image: string; date: string; caption: string; centroid_coordinates: { lat: number; lon: number } };

async function earth() {
  const days = await json<string[]>("https://epic.gsfc.nasa.gov/api/natural/available", 3600);
  const [latest, previous] = [days.at(-1), days.at(-2)];
  const load = async (day: string | undefined) => {
    if (!day) return [];
    const list = await json<Epic[]>(`https://epic.gsfc.nasa.gov/api/natural/date/${day}`, 86400);
    return list.map<Item>((e) => {
      const [y, m, d] = day.split("-");
      return {
        t: e.date.replace(" ", "T") + "Z",
        src: `https://epic.gsfc.nasa.gov/archive/natural/${y}/${m}/${d}/jpg/${e.image}.jpg`,
        full: `https://epic.gsfc.nasa.gov/archive/natural/${y}/${m}/${d}/png/${e.image}.png`,
        title: `Centred on ${e.centroid_coordinates.lat.toFixed(1)}°, ${e.centroid_coordinates.lon.toFixed(1)}°`,
        by: "DSCOVR / EPIC",
      };
    });
  };
  const [now, before] = await Promise.all([load(latest), load(previous)]);
  return {
    imagery: {
      now,
      before,
      nowLabel: `Newest day published · ${latest}`,
      beforeLabel: `Day before · ${previous}`,
      note: "NASA's EPIC camera on NOAA's DSCOVR, 1.5 million km away at the Sun–Earth L1 point, photographs the whole sunlit Earth about every 1–2 hours. NASA publishes each day after calibration, usually 1–5 days later.",
      movie: true,
    },
  };
}

/* ---------- Moon: NASA SVS Dial-a-Moon (LRO-based rendering for any hour) ---------- */

type Dial = { image: { url: string }; time: string; phase: number; age: number; diameter: number; distance: number; subsolar_lon: number; subearth_lon: number; subearth_lat: number; posangle: number };

async function moon() {
  const hour = (offset: number) => new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000 - offset).toISOString().slice(0, 16);
  const [now, before] = await Promise.all([json<Dial>(`https://svs.gsfc.nasa.gov/api/dialamoon/${hour(0)}`, 3600), json<Dial>(`https://svs.gsfc.nasa.gov/api/dialamoon/${hour(86_400_000)}`, 86400)]);
  const item = (d: Dial): Item => ({ t: d.time + ":00Z", src: d.image.url, title: `Phase ${d.phase.toFixed(1)}% · age ${d.age.toFixed(1)} d · ${Math.round(d.distance).toLocaleString("en-US")} km`, by: "NASA SVS · LRO data" });
  const strip = ({ image: _image, ...rest }: Dial) => rest;
  return {
    imagery: {
      now: [item(now)],
      before: [item(before)],
      nowLabel: "Now (this hour)",
      beforeLabel: "24 h ago",
      note: "The Moon as it appears from Earth this hour: NASA's Scientific Visualization Studio renders it from Lunar Reconnaissance Orbiter elevation and colour data with the true phase, libration and size.",
    },
    moon: { now: strip(now), before: strip(before) },
  };
}

/* ---------- NASA Image and Video Library ---------- */

type Library = { collection: { items: { href: string; data: { title: string; date_created: string; nasa_id: string; description?: string }[]; links?: { href: string }[] }[] } };

async function archive(queries: string[], match: RegExp) {
  const search = async (kind: "image" | "video") => {
    const pages = await Promise.all(queries.map((q) => settle(json<Library>(`https://images-api.nasa.gov/search?q=${encodeURIComponent(q)}&media_type=${kind}&page_size=100`, 86400))));
    return pages.flatMap((page) => page?.collection.items ?? []);
  };
  const [imageItems, videoItems] = await Promise.all([search("image"), search("video")]);
  // The library's search is loose: keep only items whose title names the body, dated no later than today.
  const today = new Date().toISOString();
  const newest = <T extends { data: { date_created: string; title: string }[] }>(items: T[]) =>
    items
      .filter((i, k, all) => match.test(i.data[0].title) && i.data[0].date_created <= today && all.findIndex((j) => j.data[0].title === i.data[0].title) === k)
      .sort((a, b) => b.data[0].date_created.localeCompare(a.data[0].date_created));
  const pics: Item[] = newest(imageItems)
    .slice(0, 8)
    .map((i) => ({ t: i.data[0].date_created, src: https(i.links?.[0]?.href ?? ""), title: i.data[0].title, by: "NASA Image Library", full: `https://images.nasa.gov/details/${encodeURIComponent(i.data[0].nasa_id)}` }));
  const vids = await Promise.all(
    newest(videoItems)
      .slice(0, 4)
      .map(async (v): Promise<Video | null> => {
        const files = await settle(json<string[]>(https(v.href), 86400));
        const mp4 = files?.find((f) => f.endsWith("~mobile.mp4")) ?? files?.find((f) => f.endsWith("~small.mp4")) ?? files?.find((f) => f.endsWith(".mp4"));
        if (!mp4) return null;
        return {
          t: v.data[0].date_created,
          title: v.data[0].title,
          thumb: https(v.links?.[0]?.href ?? ""),
          mp4: https(encodeURI(decodeURI(mp4))),
          page: `https://images.nasa.gov/details/${encodeURIComponent(v.data[0].nasa_id)}`,
        };
      }),
  );
  return { images: pics.filter((p) => p.src), videos: vids.filter((v): v is Video => v !== null) };
}

export async function GET(request: Request) {
  const body = new URL(request.url).searchParams.get("body") ?? "";
  if (!(body in BODIES)) return Response.json({ error: "unknown body" }, { status: 400 });
  const specific = body === "Mars" ? mars() : body === "Earth" ? earth() : body === "Moon" ? moon() : Promise.resolve({});
  const [own, library] = await Promise.all([settle<Record<string, unknown>>(specific), archive(BODIES[body].query, BODIES[body].match)]);
  return Response.json(
    { body, generated: new Date().toISOString(), ...(own ?? { error: "live source unreachable" }), archive: library },
    { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } },
  );
}
