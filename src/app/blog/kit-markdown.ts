import type { Block, Post } from "./posts-types";

/** An article's kit as Markdown: the kit summary followed by every section, code and source list. */
const md = (b: Block): string => {
  switch (b.kind) {
    case "p": return b.text;
    case "h": return `### ${b.text}`;
    case "list": return b.items.map((item, k) => (b.ordered ? `${k + 1}. ${item}` : `- ${item}`)).join("\n");
    case "code": return `**${b.title ?? b.lang}**\n\n\`\`\`${b.lang}\n${b.text}\n\`\`\``;
    case "video": return `- Video: [${b.title}](https://www.youtube.com/watch?v=${b.id}) — ${b.by}. ${b.note}`;
    case "resources": return b.items.map((r) => `- [${r.title}](${r.url}) — ${r.by}. ${r.note}`).join("\n");
    case "diagram": return `> Diagram: ${b.caption}`;
    case "image": return `![${b.alt}](${b.src})\n${b.credit}`;
    case "callout": return `> ${b.text}`;
    case "table": return [`| ${b.head.join(" | ")} |`, `| ${b.head.map(() => "---").join(" | ")} |`, ...b.rows.map((r) => `| ${r.join(" | ")} |`)].join("\n");
  }
};

export const kitMarkdown = (post: Post) =>
  [
    `# ${post.kit.name}`,
    `_${post.kit.tagline}_`,
    `Companion to "${post.title}" — tianming liu`,
    "## What's inside",
    post.kit.includes.map((i) => `- ${i}`).join("\n"),
    ...post.sections.flatMap((s) => [`## ${s.title}`, ...s.blocks.map(md)]),
  ].join("\n\n");
