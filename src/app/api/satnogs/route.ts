// Read-only proxy for the public SatNOGS DB / Network APIs (they do not send CORS headers).
// Only three fixed, public GET endpoints are reachable; responses are cached for an hour.
export const revalidate = 3600;

const ENDPOINTS = {
  satellite: (norad: number) => `https://db.satnogs.org/api/satellites/?norad_cat_id=${norad}&format=json`,
  transmitters: (norad: number) => `https://db.satnogs.org/api/transmitters/?satellite__norad_cat_id=${norad}&format=json`,
  observations: (norad: number) => `https://network.satnogs.org/api/observations/?norad_cat_id=${norad}&status=good&format=json`,
} as const;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind") as keyof typeof ENDPOINTS | null;
  const norad = Number(params.get("norad"));
  if (!kind || !(kind in ENDPOINTS) || !Number.isInteger(norad) || norad <= 0 || norad > 999999) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  try {
    const upstream = await fetch(ENDPOINTS[kind](norad), { headers: { Accept: "application/json" }, next: { revalidate: 3600 } });
    if (!upstream.ok) return Response.json({ error: `upstream ${upstream.status}` }, { status: 502 });
    const json = await upstream.json();
    // Observations can be large: keep the newest few.
    const body = kind === "observations" && Array.isArray(json) ? json.slice(0, 6) : json;
    return Response.json(body, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch {
    return Response.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
