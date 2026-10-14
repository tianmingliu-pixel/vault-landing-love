// Latest DSCOVR/EPIC natural-colour image of the whole sunlit Earth (NASA, public). Proxied so the browser gets one
// small JSON answer instead of calling the EPIC API (which sends no CORS headers) itself.
export const revalidate = 1800;

export async function GET() {
  try {
    const list = (await fetch("https://epic.gsfc.nasa.gov/api/natural", { next: { revalidate: 1800 } }).then((r) => r.json())) as { image: string; date: string }[];
    const last = list.at(-1);
    if (!last) return Response.json({ error: "no images" }, { status: 502 });
    const [day] = last.date.split(" ");
    const [y, m, d] = day.split("-");
    return Response.json(
      { src: `https://epic.gsfc.nasa.gov/archive/natural/${y}/${m}/${d}/jpg/${last.image}.jpg`, taken: `${last.date.replace(" ", "T")}Z` },
      { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=7200" } },
    );
  } catch {
    return Response.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
