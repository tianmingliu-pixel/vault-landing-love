import { canRead, getReader } from "../../lib/membership";
import { POSTS } from "../../blog/content";
import { kitMarkdown } from "../../blog/kit-markdown";

// Every kit in one file — the Supreme plan's bundle.
export async function GET() {
  const reader = await getReader();
  if (!canRead(reader.tier, "supreme")) return new Response("Supreme plan required", { status: 402 });
  const body = [`# The Vault — complete kit bundle`, `${POSTS.length} kits · generated ${new Date().toISOString().slice(0, 10)}`, ...POSTS.map(kitMarkdown)].join("\n\n---\n\n");
  return new Response(body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": 'attachment; filename="vault-all-kits.md"', "Cache-Control": "private, no-store" },
  });
}
