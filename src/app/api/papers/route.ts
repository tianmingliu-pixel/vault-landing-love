import { FOCUS_RESEARCH } from "../../focus-research";
import { searchPapers } from "../../lib/openalex";

// One page of a focus module's research stream (only the configured phrases can be searched).
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const focus = FOCUS_RESEARCH[params.get("focus") ?? ""];
  const stream = focus?.streams[Number(params.get("stream") ?? 0)];
  if (!stream) return Response.json({ error: "unknown stream" }, { status: 400 });
  try {
    const page = await searchPapers(stream.phrase, params.get("cursor") ?? "*");
    return Response.json(page, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch {
    return Response.json({ error: "OpenAlex unreachable" }, { status: 502 });
  }
}
