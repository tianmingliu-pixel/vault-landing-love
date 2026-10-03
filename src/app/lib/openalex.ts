/* OpenAlex (openalex.org): an open catalogue of 250M+ scholarly works, CC0. Every paper on the focus pages comes from it —
   titles, authors, venues, citation counts, abstracts and the citation graph — so nothing about a paper is made up.
   Responses are cached server-side for a week; set OPENALEX_API_KEY for a higher daily quota. */

const BASE = "https://api.openalex.org";
const WEEK = 7 * 24 * 3600;
const CS_FIELD = "primary_topic.field.id:17"; // Computer Science

export type PaperCard = { id: string; title: string; year: number | null; cited: number; authors: string[]; venue: string | null; open: boolean };
export type Paper = PaperCard & {
  abstract: string | null;
  doi: string | null;
  pdf: string | null;
  landing: string | null;
  topics: string[];
  keywords: string[];
  references: number;
  related: string[];
  type: string | null;
  institutions: string[];
};

type Raw = {
  id: string;
  display_name: string;
  publication_year: number | null;
  cited_by_count: number;
  authorships?: { author: { display_name: string }; institutions?: { display_name: string }[] }[];
  primary_location?: { source?: { display_name?: string } | null; landing_page_url?: string | null } | null;
  open_access?: { is_oa?: boolean; oa_url?: string | null };
  best_oa_location?: { pdf_url?: string | null; landing_page_url?: string | null } | null;
  abstract_inverted_index?: Record<string, number[]> | null;
  doi?: string | null;
  topics?: { display_name: string }[];
  keywords?: { display_name: string }[];
  referenced_works_count?: number;
  related_works?: string[];
  type?: string | null;
};

const CARD_FIELDS = "id,display_name,publication_year,cited_by_count,authorships,primary_location,open_access";
const shortId = (url: string) => url.replace("https://openalex.org/", "");

async function get<T>(path: string): Promise<T> {
  const key = process.env.OPENALEX_API_KEY;
  const url = `${BASE}${path}${key ? `${path.includes("?") ? "&" : "?"}api_key=${key}` : ""}`;
  const response = await fetch(url, { next: { revalidate: WEEK } });
  if (!response.ok) throw new Error(`OpenAlex ${response.status}`);
  return response.json() as Promise<T>;
}

const card = (w: Raw): PaperCard => ({
  id: shortId(w.id),
  title: w.display_name,
  year: w.publication_year,
  cited: w.cited_by_count,
  authors: (w.authorships ?? []).slice(0, 6).map((a) => a.author.display_name),
  venue: w.primary_location?.source?.display_name ?? null,
  open: Boolean(w.open_access?.is_oa),
});

/** Rebuilds an abstract from OpenAlex's inverted index (word → positions). */
function abstractOf(index: Record<string, number[]> | null | undefined) {
  if (!index) return null;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) for (const p of positions) words[p] = word;
  return words.join(" ").replace(/\s+/g, " ").trim() || null;
}

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const sameTitle = (a: string, b: string) => {
  const [x, y] = [norm(a), norm(b)];
  return x === y || x.startsWith(y) || y.startsWith(x);
};

/**
 * Landmark papers, in the order given. A DOI is used when it resolves to the right title (OpenAlex occasionally attaches a
 * DOI to the wrong record); otherwise the most-cited work with that exact title is used. Papers that can't be matched are skipped.
 */
export async function landmarkPapers(canon: { title: string; doi: string }[]): Promise<PaperCard[]> {
  const dois = canon.filter((c) => c.doi).map((c) => c.doi);
  const page = dois.length
    ? await get<{ results: Raw[] }>(`/works?filter=doi:${dois.map((d) => encodeURIComponent(d)).join("|")}&per-page=50&select=${CARD_FIELDS},doi`)
    : { results: [] };
  const byDoi = new Map(page.results.map((w) => [(w.doi ?? "").toLowerCase().replace("https://doi.org/", ""), w]));
  const found = await Promise.all(
    canon.map(async ({ title, doi }) => {
      const hit = doi ? byDoi.get(doi.toLowerCase()) : undefined;
      if (hit && sameTitle(hit.display_name, title)) return hit;
      const search = await get<{ results: Raw[] }>(
        `/works?filter=title.search:${encodeURIComponent(`"${title.replace(/[:"]/g, " ")}"`)}&sort=cited_by_count:desc&per-page=5&select=${CARD_FIELDS}`,
      ).catch(() => ({ results: [] as Raw[] }));
      return search.results.find((w) => sameTitle(w.display_name, title)) ?? null;
    }),
  );
  return found.filter((w): w is Raw => w !== null).map(card);
}

/** Most-cited computer-science works matching a phrase, one page at a time (cursor paging, so it never runs out). */
export async function searchPapers(phrase: string, cursor = "*"): Promise<{ items: PaperCard[]; next: string | null; total: number }> {
  const filter = `title_and_abstract.search:${encodeURIComponent(`"${phrase}"`)},${CS_FIELD},cited_by_count:>10`;
  const page = await get<{ results: Raw[]; meta: { next_cursor: string | null; count: number } }>(
    `/works?filter=${filter}&sort=cited_by_count:desc&per-page=12&cursor=${encodeURIComponent(cursor)}&select=${CARD_FIELDS}`,
  );
  return { items: page.results.map(card), next: page.meta.next_cursor, total: page.meta.count };
}

export async function paper(id: string): Promise<Paper> {
  const w = await get<Raw>(`/works/${id}?select=${CARD_FIELDS},abstract_inverted_index,doi,best_oa_location,topics,keywords,referenced_works_count,related_works,type`);
  return {
    ...card(w),
    authors: (w.authorships ?? []).map((a) => a.author.display_name),
    abstract: abstractOf(w.abstract_inverted_index),
    doi: w.doi ?? null,
    pdf: w.best_oa_location?.pdf_url ?? null,
    landing: w.best_oa_location?.landing_page_url ?? w.primary_location?.landing_page_url ?? w.doi ?? null,
    topics: (w.topics ?? []).slice(0, 4).map((t) => t.display_name),
    keywords: (w.keywords ?? []).slice(0, 8).map((k) => k.display_name),
    references: w.referenced_works_count ?? 0,
    related: (w.related_works ?? []).slice(0, 9).map(shortId),
    type: w.type ?? null,
    institutions: [...new Set((w.authorships ?? []).flatMap((a) => (a.institutions ?? []).map((i) => i.display_name)))].slice(0, 6),
  };
}

export async function papersById(ids: string[]): Promise<PaperCard[]> {
  if (!ids.length) return [];
  const page = await get<{ results: Raw[] }>(`/works?filter=openalex_id:${ids.join("|")}&per-page=${ids.length}&select=${CARD_FIELDS}`);
  return page.results.map(card).sort((a, b) => b.cited - a.cited);
}

/** The most-cited works that cite this one: where the idea went next. */
export async function citedBy(id: string): Promise<PaperCard[]> {
  const page = await get<{ results: Raw[] }>(`/works?filter=cites:${id}&sort=cited_by_count:desc&per-page=9&select=${CARD_FIELDS}`);
  return page.results.map(card);
}
