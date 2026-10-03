import { canRead, getReader } from "../../../lib/membership";
import { postBySlug } from "../../../blog/content";
import { kitMarkdown } from "../../../blog/kit-markdown";

// An article's kit as a Markdown download — Diamond and Supreme plans only.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const post = postBySlug((await params).slug);
  if (!post) return new Response("not found", { status: 404 });
  const reader = await getReader();
  if (!canRead(reader.tier, "diamond")) return new Response("Diamond or Supreme plan required", { status: 402 });
  return new Response(kitMarkdown(post), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename="${post.slug}-kit.md"`, "Cache-Control": "private, no-store" },
  });
}
