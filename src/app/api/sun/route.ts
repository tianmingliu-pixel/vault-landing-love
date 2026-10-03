// Live images of the Sun, relayed same-origin (the source hosts send no CORS headers, and WebGL textures need them),
// with the observation time of each image in the `X-Observed` header.
//   SUVI* — NOAA GOES-19 Solar Ultraviolet Imager: a new image every 4 minutes (operational space-weather feed)
//   HMI* / AIA* — NASA SDO, via the Helioviewer API (the closest SDO image to "now", usually 1–4 h old)
//   C2 / C3 — SOHO LASCO coronagraphs via NOAA SWPC
// SDO's own "latest" JPEGs are not used: they can stop updating for days while the mission keeps observing.

const SUVI_BANDS = ["094", "131", "171", "195", "284", "304"] as const;
const HELIOVIEWER: Record<string, { sourceId: number; layer: string }> = {
  HMIMAG: { sourceId: 19, layer: "[SDO,HMI,HMI,magnetogram,1,100]" },
  HMIINT: { sourceId: 18, layer: "[SDO,HMI,HMI,continuum,1,100]" },
  AIA193: { sourceId: 11, layer: "[SDO,AIA,AIA,193,1,100]" },
  AIA171: { sourceId: 10, layer: "[SDO,AIA,AIA,171,1,100]" },
  AIA304: { sourceId: 13, layer: "[SDO,AIA,AIA,304,1,100]" },
};
const LASCO: Record<string, string> = {
  C2: "https://services.swpc.noaa.gov/images/animations/lasco-c2/latest.jpg",
  C3: "https://services.swpc.noaa.gov/images/animations/lasco-c3/latest.jpg",
};

const image = (body: ArrayBuffer, type: string, observed: string, maxAge: number) =>
  new Response(body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 4}`,
      "X-Observed": observed,
      "Access-Control-Expose-Headers": "X-Observed",
    },
  });

async function suvi(band: string) {
  const base = `https://services.swpc.noaa.gov/images/animations/suvi/primary/${band}/`;
  try {
    const listing = await fetch(base, { next: { revalidate: 120 } }).then((r) => r.text());
    const files = [...listing.matchAll(/href="(or_suvi-[^"]+_s(\d{8}T\d{6})Z[^"]*\.png)"/g)];
    const last = files.at(-1);
    if (!last) throw new Error("no SUVI files");
    const t = last[2];
    const observed = `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}T${t.slice(9, 11)}:${t.slice(11, 13)}:${t.slice(13, 15)}Z`;
    // The listing can stall while latest.png keeps updating — use whichever is newer.
    const head = await fetch(base + "latest.png", { method: "HEAD", next: { revalidate: 120 } }).catch(() => null);
    const modified = head?.headers.get("last-modified");
    if (modified && Date.parse(modified) - Date.parse(observed) > 10 * 60_000) throw new Error("listing behind latest.png");
    const response = await fetch(base + last[1], { next: { revalidate: 3600 } });
    if (!response.ok) throw new Error(`SUVI ${response.status}`);
    return image(await response.arrayBuffer(), "image/png", observed, 120);
  } catch {
    // Fallback: the directory listing changed or timed out — use latest.png and its Last-Modified time instead.
    const response = await fetch(base + "latest.png", { next: { revalidate: 120 } });
    if (!response.ok) throw new Error(`SUVI latest ${response.status}`);
    const modified = response.headers.get("last-modified");
    return image(await response.arrayBuffer(), "image/png", modified ? new Date(modified).toISOString() : "", 120);
  }
}

async function helioviewer(key: string) {
  const { sourceId, layer } = HELIOVIEWER[key];
  const now = new Date().toISOString().slice(0, 19) + "Z";
  const closest = await fetch(`https://api.helioviewer.org/v2/getClosestImage/?date=${now}&sourceId=${sourceId}`, { next: { revalidate: 600 } }).then(
    (r) => r.json() as Promise<{ date?: string }>,
  );
  const date = closest.date ? closest.date.replace(" ", "T") + "Z" : now;
  // 2.4 arcsec per pixel puts the solar disk (about 1,920 arcsec across) at ~800 px in a 1,024 px frame.
  const url = `https://api.helioviewer.org/v2/takeScreenshot/?date=${date}&imageScale=2.4&layers=${layer}&x0=0&y0=0&width=1024&height=1024&display=true&watermark=false`;
  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image")) throw new Error(`Helioviewer ${response.status}`);
  return image(await response.arrayBuffer(), "image/png", date, 600);
}

async function lasco(key: string) {
  const response = await fetch(LASCO[key], { next: { revalidate: 300 } });
  if (!response.ok) throw new Error(`LASCO ${response.status}`);
  const modified = response.headers.get("last-modified");
  return image(await response.arrayBuffer(), "image/jpeg", modified ? new Date(modified).toISOString() : "", 300);
}

export async function GET(request: Request) {
  const view = new URL(request.url).searchParams.get("view") ?? "";
  try {
    if (view.startsWith("SUVI") && (SUVI_BANDS as readonly string[]).includes(view.slice(4))) return await suvi(view.slice(4));
    if (view in HELIOVIEWER) return await helioviewer(view);
    if (view in LASCO) return await lasco(view);
    return new Response("unknown view", { status: 400 });
  } catch {
    return new Response("upstream unreachable", { status: 502 });
  }
}
