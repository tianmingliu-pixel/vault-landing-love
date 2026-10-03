import type { Tier } from "../lib/tiers";

export type Resource = { title: string; by: string; url: string; kind: "doc" | "video" | "paper" | "course" | "book" | "standard" | "tool"; note: string };

export type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "list"; items: string[]; ordered?: boolean }
  | { kind: "code"; lang: string; title?: string; text: string }
  | { kind: "video"; id: string; title: string; by: string; note: string }
  | { kind: "resources"; items: Resource[] }
  | { kind: "diagram"; name: DiagramName; caption: string }
  | { kind: "image"; src: string; alt: string; credit: string }
  | { kind: "callout"; tone: "info" | "warn"; text: string }
  | { kind: "table"; head: string[]; rows: string[][] };

export type DiagramName = "trust-boundary" | "training-loop" | "agent-boundary" | "data-pipeline" | "space-data-path";

export type Section = { id: string; access: Tier; title: string; teaser: string; blocks: Block[] };

export type Post = {
  slug: string;
  focus: string | null;
  title: string;
  subtitle: string;
  date: string;
  minutes: number;
  accent: string;
  motif: "lattice" | "neurons" | "orbit-agent" | "columns" | "sky";
  kit: { name: string; tagline: string; includes: string[] };
  sections: Section[];
};
