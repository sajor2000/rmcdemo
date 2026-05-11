import { tool } from "ai";
import { z } from "zod";
import {
  searchPubMed,
  fetchMetadata,
  convertToPMC,
  fetchFullText,
} from "./pubmed";
import {
  fetchOpenAlexByDoi,
  fetchOpenAlexByDois,
  searchOpenAlexWorks,
} from "./openalex";
import { REQUIRED_ARTIFACT_IDS } from "./types";

const TAVILY_TIMEOUT_MS = 12_000;
const PUBMED_FULLTEXT_CHARS = 8_000;

/**
 * Prefix any CSV cell whose first char would be parsed as a formula by Excel,
 * Numbers, or LibreOffice. Without this, a model that emits `=HYPERLINK(...)`
 * or `+1-555-1212` in a cell turns a downloaded CSV into a code-execution
 * surface when the instructor opens it.
 */
function sanitizeCsvFormulas(csv: string): string {
  const dangerous = /^[=+\-@\t\r]/;
  return csv
    .split(/\r?\n/)
    .map((line) =>
      line
        .split(",")
        .map((cell) => {
          const trimmed = cell.startsWith('"') ? cell : cell.trimStart();
          const inner = trimmed.startsWith('"') ? trimmed.slice(1) : trimmed;
          return dangerous.test(inner) ? `'${cell}` : cell;
        })
        .join(",")
    )
    .join("\n");
}

export const pubmedSearch = tool({
  description:
    "Search PubMed/MEDLINE for biomedical articles. Use Boolean operators and field tags like [Title], [MeSH Terms], [Publication Type]. Returns PMIDs and total result count.",
  parameters: z.object({
    query: z
      .string()
      .trim()
      .min(3)
      .max(2000)
      .describe("PubMed query with Boolean operators and field tags"),
    maxResults: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(20)
      .describe("Max articles to return"),
    dateFrom: z
      .string()
      .regex(/^\d{4}$/)
      .optional()
      .describe("Start year filter, e.g. '2022'"),
  }),
  execute: async ({ query, maxResults, dateFrom }) => {
    const result = await searchPubMed(query, Math.min(maxResults, 20), dateFrom);
    return {
      pmids: result.pmids,
      totalCount: result.totalCount,
      retrieved: result.pmids.length,
    };
  },
});

export const pubmedMetadata = tool({
  description:
    "Fetch detailed metadata (title, authors, abstract, journal, DOI, MeSH terms) for a list of PubMed article IDs. Also checks which articles have free full text in PMC.",
  parameters: z.object({
    pmids: z
      .array(z.string().regex(/^\d+$/))
      .min(1)
      .max(20)
      .describe("List of PubMed IDs to fetch metadata for"),
  }),
  execute: async ({ pmids }) => {
    const [articles, pmcMap] = await Promise.all([
      fetchMetadata(pmids),
      convertToPMC(pmids).catch(() => ({} as Record<string, string>)),
    ]);
    return articles.map((a) => ({
      pmid: a.pmid,
      title: a.title,
      authors: a.authors,
      journal: a.journal,
      year: a.year,
      abstract: a.abstract?.slice(0, 1200) || "",
      doi: a.doi,
      pmcid: pmcMap[a.pmid] || a.pmcid || null,
      hasFullText: !!(pmcMap[a.pmid] || a.pmcid),
    }));
  },
});

export const pubmedFulltext = tool({
  description:
    "Fetch full-text content from PubMed Central for open-access articles. Takes up to 25 PMC IDs (e.g. PMC12345) per call. Returns first ~8000 chars of body text per article. Internally fetches all requested PMC IDs in parallel.",
  parameters: z.object({
    pmcIds: z
      .array(z.string().regex(/^PMC\d+$/i))
      .min(1)
      .max(25)
      .describe("PMC IDs to fetch full text for (max 25 per call)"),
  }),
  execute: async ({ pmcIds }) => {
    const settled = await Promise.allSettled(pmcIds.map((id) => fetchFullText(id)));
    const results: Record<string, string> = {};
    pmcIds.forEach((id, i) => {
      const r = settled[i];
      if (r.status === "fulfilled" && r.value) {
        results[id] = r.value.slice(0, PUBMED_FULLTEXT_CHARS);
      } else {
        results[id] = "[fetch failed]";
      }
    });
    return results;
  },
});

export const openAlexSearch = tool({
  description:
    "Search OpenAlex for scholarly works (papers, reviews) across all disciplines. Uses the cheap Filter-tier API path. Use to cross-check or supplement PubMed when looking for broader scholarly coverage, open-access full text, or citation counts. Always returns works with an abstract unless requireAbstract is explicitly false. Returns title, authors, year, DOI, venue, abstract, open-access URL, citation count, and any linked PMID/PMCID. To surface systematic reviews or meta-analyses, include those terms in the query string — OpenAlex does not classify them as separate `type` values.",
  parameters: z.object({
    query: z
      .string()
      .trim()
      .min(3)
      .max(2000)
      .describe("Search query. Supports AND, OR, NOT (uppercase) and quoted phrases."),
    perPage: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(10)
      .describe("Maximum number of works to return"),
    yearFrom: z
      .number()
      .int()
      .min(1900)
      .max(2100)
      .optional()
      .describe("Earliest publication year to include"),
    yearTo: z
      .number()
      .int()
      .min(1900)
      .max(2100)
      .optional()
      .describe("Latest publication year to include"),
    publicationTypes: z
      .array(
        z.enum([
          "review",
          "article",
          "letter",
          "editorial",
          "book-chapter",
          "preprint",
        ])
      )
      .max(5)
      .optional()
      .describe(
        "OpenAlex work types to filter by. Use 'review' for evidence-synthesis reviews. OpenAlex does not classify systematic reviews or meta-analyses as separate types — surface those by including 'systematic review' or 'meta-analysis' in the query string instead."
      ),
    openAccessOnly: z
      .boolean()
      .optional()
      .describe("When true, restrict results to open-access works only"),
    minCitations: z
      .number()
      .int()
      .min(0)
      .max(10000)
      .optional()
      .describe("Minimum citation count threshold. Use 10-50 to prioritize impactful evidence."),
    requireAbstract: z
      .boolean()
      .optional()
      .describe(
        "Defaults to true (only works with an abstract). Set false only if you specifically need records without abstracts."
      ),
  }),
  execute: async ({
    query,
    perPage,
    yearFrom,
    yearTo,
    publicationTypes,
    openAccessOnly,
    minCitations,
    requireAbstract,
  }) => {
    try {
      const result = await searchOpenAlexWorks(query, {
        perPage,
        yearFrom,
        yearTo,
        publicationTypes,
        openAccessOnly,
        minCitations,
        requireAbstract,
      });
      return {
        totalCount: result.totalCount,
        retrieved: result.works.length,
        works: result.works,
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "OpenAlex search failed",
        works: [],
        totalCount: 0,
        retrieved: 0,
      };
    }
  },
});

export const openAlexLookupByDoi = tool({
  description:
    "Look up scholarly works in OpenAlex by DOI. Accepts a single DOI or a batch of up to 50 DOIs in one call (batch uses the cheap Filter-tier OR-operator path). Use to verify citations, fetch open-access URLs, or cross-check publication metadata returned by other tools.",
  parameters: z
    .object({
      doi: z
        .string()
        .trim()
        .min(5)
        .max(200)
        .optional()
        .describe("Single DOI string, with or without the https://doi.org/ prefix"),
      dois: z
        .array(z.string().trim().min(5).max(200))
        .min(1)
        .max(50)
        .optional()
        .describe("Batch of up to 50 DOIs. Cheaper than calling this tool repeatedly."),
    })
    .refine((d) => Boolean(d.doi) || (d.dois?.length ?? 0) > 0, {
      message: "Provide either `doi` or `dois`",
    }),
  execute: async ({ doi, dois }) => {
    // Merge so passing both works (dois takes precedence; doi is appended).
    const batch = [...(dois ?? []), ...(doi ? [doi] : [])];
    if (batch.length > 1) {
      try {
        const works = await fetchOpenAlexByDois(batch);
        return {
          found: works.length > 0,
          works,
          retrieved: works.length,
          requested: batch.length,
        };
      } catch (err) {
        return {
          found: false,
          error: err instanceof Error ? err.message : "OpenAlex batch lookup failed",
          works: [],
          retrieved: 0,
          requested: batch.length,
        };
      }
    }
    if (batch.length === 1) {
      try {
        const work = await fetchOpenAlexByDoi(batch[0]);
        if (!work) {
          return {
            found: false,
            error: "No OpenAlex record found for that DOI",
            works: [],
            retrieved: 0,
            requested: 1,
          };
        }
        return { found: true, works: [work], retrieved: 1, requested: 1 };
      } catch (err) {
        return {
          found: false,
          error: err instanceof Error ? err.message : "OpenAlex DOI lookup failed",
          works: [],
          retrieved: 0,
          requested: 1,
        };
      }
    }
    return {
      found: false,
      error: "Provide either `doi` or `dois`",
      works: [],
      retrieved: 0,
      requested: 0,
    };
  },
});

export const webSearch = tool({
  description:
    "Search the web for recent information using Tavily. Useful for finding guideline updates, clinical trial results, or context not yet indexed in PubMed.",
  parameters: z.object({
    query: z.string().trim().min(3).max(300).describe("Search query"),
  }),
  execute: async ({ query }) => {
    if (!process.env.TAVILY_API_KEY) {
      return { error: "Tavily API key is not configured" };
    }
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: 5,
        search_depth: "advanced",
      }),
      signal: AbortSignal.timeout(TAVILY_TIMEOUT_MS),
    });
    if (!res.ok) return { error: `Tavily API error: ${res.status}` };
    const data = await res.json();
    return {
      results: (data.results || []).map(
        (r: { title: string; url: string; content: string }) => ({
          title: r.title,
          url: r.url,
          snippet: r.content?.slice(0, 500),
        })
      ),
    };
  },
});

export const saveArtifact = tool({
  description:
    "Save a research artifact (markdown or CSV content) that will be displayed to the user and available for download. Call this for each deliverable: search_strategy, screening_log, article_summaries, evidence_table_md, evidence_table_csv, narrative_synthesis.",
  parameters: z.object({
    id: z
      .enum(REQUIRED_ARTIFACT_IDS)
      .describe(
        "Artifact ID. One of: " + REQUIRED_ARTIFACT_IDS.join(", ")
      ),
    label: z.string().trim().min(1).max(80).describe("Human-readable label for the tab, e.g. 'Search Strategy'"),
    filename: z.string().trim().min(1).max(120).describe("Download filename, e.g. 'search_strategy.md'"),
    content: z.string().min(1).max(200_000).describe("Full markdown or CSV content of the artifact"),
  }),
  execute: async ({ id, label, filename, content }) => {
    // Sanitize CSV artifacts to defang spreadsheet formula prefixes (=, +, -, @)
    // so a downloaded evidence_table.csv can't execute formulas in Excel/Numbers.
    const safeContent =
      id === "evidence_table_csv" ? sanitizeCsvFormulas(content) : content;
    return { id, label, filename, content: safeContent, saved: true, length: safeContent.length };
  },
});
