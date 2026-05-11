const BASE = "https://api.openalex.org";
// OpenAlex is generally faster than NCBI but can still hiccup under
// demo load; matching pubmed.ts timeout + retry policy keeps the two
// failure profiles symmetric.
const FETCH_TIMEOUT_MS = 20_000;
const RETRY_BACKOFF_MS = 2_000;

function isTransient(err: unknown, status?: number): boolean {
  if (status !== undefined && (status >= 500 || status === 429)) return true;
  if (err instanceof DOMException && err.name === "TimeoutError") return true;
  if (err instanceof TypeError) return true;
  return false;
}
// OpenAlex polite-pool requires a real contact email. Set OPENALEX_MAILTO in
// .env.local to identify your deployment. The fallback is a placeholder; using
// it works but may eventually be rate-limited by OpenAlex.
const POLITE_POOL_MAILTO_FALLBACK = "classroom-demo@research-agent.local";

export interface OpenAlexWork {
  id: string;
  doi: string | null;
  title: string;
  abstract: string;
  authors: string;
  year: number | null;
  venue: string | null;
  publicationType: string | null;
  isOpenAccess: boolean;
  openAccessUrl: string | null;
  citedByCount: number;
  pmid: string | null;
  pmcid: string | null;
}

function withAuth(params: Record<string, string>): string {
  const search = new URLSearchParams(params);
  const apiKey = process.env.OPENALEX_API_KEY;
  if (apiKey) {
    search.set("api_key", apiKey);
  } else {
    // Polite-pool requires a real mailto. Prefer the configured contact;
    // fall back to a documented placeholder if none is set.
    search.set("mailto", process.env.OPENALEX_MAILTO || POLITE_POOL_MAILTO_FALLBACK);
  }
  return search.toString();
}

function scrubKey(message: string): string {
  // Defensively strip any leaked api_key=... query parameter from upstream
  // error bodies before they propagate into thrown errors.
  return message.replace(/([?&])api_key=[^&\s"]+/gi, "$1api_key=[redacted]");
}

async function fetchJson<T>(url: string, service: string): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      const text = await res.text();
      if (!res.ok) {
        if (isTransient(undefined, res.status) && attempt === 0) {
          console.warn(
            `[${service}] HTTP ${res.status}, retrying after ${RETRY_BACKOFF_MS}ms`
          );
          await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
          continue;
        }
        throw new Error(
          `${service} returned ${res.status}: ${scrubKey(text.slice(0, 200))}`
        );
      }
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new Error(`${service} returned invalid JSON`);
      }
    } catch (err) {
      if (isTransient(err) && attempt === 0) {
        const reason =
          err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        console.warn(
          `[${service}] transient error (${reason}), retrying after ${RETRY_BACKOFF_MS}ms`
        );
        await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
        continue;
      }
      throw err;
    }
  }
  throw new Error(`${service} failed after retry`);
}

function decodeInvertedAbstract(
  index: Record<string, number[]> | null | undefined
): string {
  if (!index) return "";
  const positions: Array<{ position: number; word: string }> = [];
  for (const [word, places] of Object.entries(index)) {
    for (const place of places) {
      positions.push({ position: place, word });
    }
  }
  positions.sort((a, b) => a.position - b.position);
  return positions.map((entry) => entry.word).join(" ");
}

interface OpenAlexAuthorship {
  author?: { display_name?: string | null } | null;
}

interface OpenAlexLocation {
  source?: { display_name?: string | null } | null;
}

interface OpenAlexIds {
  doi?: string | null;
  pmid?: string | null;
  pmcid?: string | null;
}

interface OpenAlexOpenAccess {
  is_oa?: boolean;
  oa_url?: string | null;
}

interface OpenAlexRawWork {
  id?: string;
  title?: string | null;
  display_name?: string | null;
  doi?: string | null;
  publication_year?: number | null;
  authorships?: OpenAlexAuthorship[];
  primary_location?: OpenAlexLocation | null;
  ids?: OpenAlexIds;
  type?: string | null;
  type_crossref?: string | null;
  open_access?: OpenAlexOpenAccess;
  cited_by_count?: number;
  abstract_inverted_index?: Record<string, number[]> | null;
}

function extractPmidLike(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/(\d{4,})/);
  return match ? match[1] : null;
}

function extractPmcLike(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.match(/PMC\d+/i);
  return match ? match[0].toUpperCase() : null;
}

function normalizeDoi(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
}

function normalizeWork(work: OpenAlexRawWork): OpenAlexWork {
  const authors = (work.authorships ?? [])
    .slice(0, 3)
    .map((a) => a.author?.display_name)
    .filter((name): name is string => Boolean(name));

  const totalAuthors = work.authorships?.length ?? 0;
  const authorString =
    totalAuthors > 3 ? `${authors.join(", ")}, et al.` : authors.join(", ");

  return {
    id: work.id ?? "",
    doi: normalizeDoi(work.doi),
    title: work.title ?? work.display_name ?? "",
    abstract: decodeInvertedAbstract(work.abstract_inverted_index).slice(0, 1500),
    authors: authorString,
    year: work.publication_year ?? null,
    venue: work.primary_location?.source?.display_name ?? null,
    publicationType: work.type ?? work.type_crossref ?? null,
    isOpenAccess: Boolean(work.open_access?.is_oa),
    openAccessUrl: work.open_access?.oa_url ?? null,
    citedByCount: work.cited_by_count ?? 0,
    pmid: extractPmidLike(work.ids?.pmid),
    pmcid: extractPmcLike(work.ids?.pmcid),
  };
}

export interface OpenAlexSearchOptions {
  perPage?: number;
  yearFrom?: number;
  yearTo?: number;
  publicationTypes?: string[];
  openAccessOnly?: boolean;
  /** Require an abstract on every returned work (skips records with no abstract_inverted_index). */
  requireAbstract?: boolean;
  /** Only return works cited at least this many times. */
  minCitations?: number;
}

function escapeFilterValue(value: string): string {
  // OpenAlex filter syntax uses comma + pipe as separators; replace them and any
  // colons that could break the parser. Slashes survive (we accept DOI URLs).
  return value.replace(/[,|:]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Search OpenAlex /works using the Filter-tier path (`default.search:` inside
 * filter=) instead of the top-level `search=` parameter.
 *
 * OpenAlex free tier ($1/day budget) per-day quotas:
 *   - Get single entity (e.g. /works/doi:X) : unlimited, free
 *   - List+filter (this function)            : 10,000 calls, 1M results
 *   - Search (search=...)                    : 1,000 calls, 100k results
 *   - Content downloads                      : 100 PDFs
 *
 * One classroom run uses ~1 filter call here, so the 10k/day cap leaves room
 * for ~5,000 demo runs per day on the free tier. Ranking quality is the same
 * as the search= path; only the noise floor differs because of has_abstract.
 */
export async function searchOpenAlexWorks(
  query: string,
  options: OpenAlexSearchOptions = {}
): Promise<{ totalCount: number; works: OpenAlexWork[] }> {
  const perPage = Math.min(Math.max(options.perPage ?? 10, 1), 25);
  const filters: string[] = [`default.search:${escapeFilterValue(query)}`];

  // Normalize: if the caller sent yearFrom > yearTo, swap them rather than
  // emitting the inverted `publication_year:2030-2020` filter that returns 0.
  let yearFrom = options.yearFrom;
  let yearTo = options.yearTo;
  if (yearFrom && yearTo && yearFrom > yearTo) {
    [yearFrom, yearTo] = [yearTo, yearFrom];
  }

  if (yearFrom && yearTo) {
    filters.push(`publication_year:${yearFrom}-${yearTo}`);
  } else if (yearFrom) {
    filters.push(`publication_year:>${yearFrom - 1}`);
  } else if (yearTo) {
    filters.push(`publication_year:<${yearTo + 1}`);
  }
  if (options.publicationTypes && options.publicationTypes.length > 0) {
    filters.push(`type:${options.publicationTypes.join("|")}`);
  }
  if (options.openAccessOnly) {
    filters.push("open_access.is_oa:true");
  }
  if (options.requireAbstract !== false) {
    // Default ON — useless to return works without abstracts for evidence synthesis.
    filters.push("has_abstract:true");
  }
  if (options.minCitations && options.minCitations > 0) {
    filters.push(`cited_by_count:>${options.minCitations - 1}`);
  }

  const params: Record<string, string> = {
    filter: filters.join(","),
    per_page: String(perPage),
    sort: "relevance_score:desc",
  };

  const data = await fetchJson<{
    meta?: { count?: number };
    results?: OpenAlexRawWork[];
  }>(`${BASE}/works?${withAuth(params)}`, "OpenAlex search");

  return {
    totalCount: data.meta?.count ?? 0,
    works: (data.results ?? []).map(normalizeWork),
  };
}

const DOI_PATTERN = /^10\.\d{4,}\/\S+$/;

/**
 * Look up a single work in OpenAlex by DOI. Returns null only when the DOI is
 * a clean 404 (record not found). All other errors propagate so callers can
 * distinguish "not found" from "OpenAlex unavailable".
 */
export async function fetchOpenAlexByDoi(doi: string): Promise<OpenAlexWork | null> {
  const normalized = normalizeDoi(doi);
  if (!normalized || !DOI_PATTERN.test(normalized)) return null;
  try {
    const data = await fetchJson<OpenAlexRawWork>(
      `${BASE}/works/doi:${encodeURIComponent(normalized)}?${withAuth({})}`,
      "OpenAlex DOI lookup"
    );
    return normalizeWork(data);
  } catch (err) {
    // Surface 404 as null (not found), propagate everything else.
    if (err instanceof Error && /\b404\b/.test(err.message)) return null;
    throw err;
  }
}

/**
 * Batch lookup of up to 50 DOIs in a single Filter-tier call using the OR
 * operator (`doi:a|b|c`).
 *
 * Note: individual /works/doi:X gets are unlimited+free on the OpenAlex free
 * tier, so the batch path is not strictly cheaper — but it collapses N HTTP
 * round-trips into 1, which materially improves wall-clock time during a live
 * classroom demo where the agent often verifies 5-15 DOIs in one synthesis
 * step.
 *
 * Errors propagate so callers can distinguish "no DOIs matched" from
 * "OpenAlex unavailable". DOIs that don't match the canonical pattern are
 * silently dropped before joining to prevent filter-syntax injection.
 */
export async function fetchOpenAlexByDois(dois: string[]): Promise<OpenAlexWork[]> {
  const normalized = Array.from(
    new Set(
      dois
        .map(normalizeDoi)
        .filter((d): d is string => Boolean(d) && DOI_PATTERN.test(d as string))
    )
  ).slice(0, 50);
  if (normalized.length === 0) return [];

  // Select only the fields the agent actually consumes, so the response payload
  // doesn't include 5-20 KB/work of abstract_inverted_index for a citation
  // cross-check that just needs metadata + OA URL.
  const params: Record<string, string> = {
    filter: `doi:${normalized.map((d) => `https://doi.org/${d}`).join("|")}`,
    per_page: String(normalized.length),
    select:
      "id,doi,display_name,title,publication_year,authorships,primary_location,ids,type,open_access,cited_by_count",
  };

  const data = await fetchJson<{ results?: OpenAlexRawWork[] }>(
    `${BASE}/works?${withAuth(params)}`,
    "OpenAlex DOI batch lookup"
  );
  return (data.results ?? []).map(normalizeWork);
}
