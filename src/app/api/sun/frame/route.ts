import sharp from "sharp";

// One frame of a Sun movie, shrunk to 512 px WebP (a SUVI PNG is ~650 KB; this is a few tens of KB).
// A frame never changes once observed, so it is cached for a year. Only whitelisted file-name shapes are accepted.

const SUVI_BANDS = ["094", "131", "171", "195", "284", "304"];
// Helioviewer layers, with the arcsec-per-pixel scale that frames each one in a 1,024 px image.
const HV_LAYERS: Record<string, [layer: string, scale: number]> = {
  HMIMAG: ["[SDO,HMI,HMI,magnetogram,1,100]", 2.4],
  HMIINT: ["[SDO,HMI,HMI,continuum,1,100]", 2.4],
  AIA193: ["[SDO,AIA,AIA,193,1,100]", 2.4],
  AIA171: ["[SDO,AIA,AIA,171,1,100]", 2.4],
  AIA304: ["[SDO,AIA,AIA,304,1,100]", 2.4],
  AIA131: ["[SDO,AIA,AIA,131,1,100]", 2.4],
  LASCOC3: ["[SOHO,LASCO,C3,white-light,1,100]", 56],
};
const LASCO_DIRS: Record<string, string> = { C2: "lasco-c2", C3: "lasco-c3" };

function upstream(s: string, k: string, f: string): string | null {
  if (s === "suvi" && SUVI_BANDS.includes(k) && (/^or_suvi-[\w.-]+\.png$/.test(f) || f === "latest.png")) return `https://services.swpc.noaa.gov/images/animations/suvi/primary/${k}/${f}`;
  if (s === "lasco" && k in LASCO_DIRS && /^\d{8}_\d{4}_c[23]_512\.jpg$/.test(f)) return `https://services.swpc.noaa.gov/images/animations/${LASCO_DIRS[k]}/${f}`;
  if (s === "hv" && k in HV_LAYERS && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(f))
    return `https://api.helioviewer.org/v2/takeScreenshot/?date=${f}&imageScale=${HV_LAYERS[k][1]}&layers=${HV_LAYERS[k][0]}&x0=0&y0=0&width=1024&height=1024&display=true&watermark=false`;
  return null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const url = upstream(params.get("s") ?? "", params.get("k") ?? "", params.get("f") ?? "");
  if (!url) return new Response("bad frame", { status: 400 });
  try {
    // latest.png changes every few minutes (the `at` parameter keys each version); every other frame is fixed forever.
    const moving = url.endsWith("/latest.png");
    const response = await fetch(url, { next: { revalidate: moving ? 120 : 31_536_000 } });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image")) return new Response("upstream error", { status: 502 });
    const small = await sharp(Buffer.from(await response.arrayBuffer())).resize(512, 512, { fit: "inside" }).webp({ quality: 78 }).toBuffer();
    return new Response(new Uint8Array(small), {
      headers: { "Content-Type": "image/webp", "Cache-Control": moving ? "public, max-age=600" : "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("upstream unreachable", { status: 502 });
  }
}
