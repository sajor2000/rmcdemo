import type { PubMedArticle } from "./types";

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const TOOL = "research-agent-demo";
const EMAIL = "demo@example.com";

function qs(params: Record<string, string>) {
  return new URLSearchParams({ ...params, tool: TOOL, email: EMAIL }).toString();
}

const FETCH_TIMEOUT_MS = 12_000;

async function fetchText(url: string, service: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${service} returned ${res.status}: ${text.slice(0, 160)}`);
  }
  return text;
}

async function fetchJson<T>(url: string, service: string): Promise<T> {
  const text = await fetchText(url, service);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${service} returned invalid JSON`);
  }
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) =>
      String.fromCharCode(Number.parseInt(code, 16))
    );
}

function stripXml(value: string): string {
  return decodeEntities(
    value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  );
}

export async function searchPubMed(
  query: string,
  maxResults = 20,
  dateFrom?: string
): Promise<{ pmids: string[]; totalCount: number }> {
  const params: Record<string, string> = {
    db: "pubmed",
    term: query,
    retmode: "json",
    retmax: String(maxResults),
    sort: "pub_date",
  };
  if (dateFrom) {
    params.mindate = dateFrom;
    params.maxdate = new Date().getFullYear().toString();
    params.datetype = "pdat";
  }

  const data = await fetchJson<{
    esearchresult?: { idlist?: string[]; count?: string };
  }>(`${BASE}/esearch.fcgi?${qs(params)}`, "PubMed search");
  return {
    pmids: data.esearchresult?.idlist ?? [],
    totalCount: Number(data.esearchresult?.count ?? 0),
  };
}

export async function fetchMetadata(pmids: string[]): Promise<PubMedArticle[]> {
  if (pmids.length === 0) return [];

  const xml = await fetchText(
    `${BASE}/efetch.fcgi?${qs({
      db: "pubmed",
      id: pmids.join(","),
      rettype: "xml",
      retmode: "xml",
    })}`,
    "PubMed metadata"
  );

  const articles: PubMedArticle[] = [];
  const articleBlocks = xml.split("<PubmedArticle>").slice(1);

  for (const block of articleBlocks) {
    const pmid = extract(block, "PMID") || "";
    const title = extract(block, "ArticleTitle") || "";
    const abstractTexts: string[] = [];
    const abstractParts = block.split("<AbstractText");
    for (let i = 1; i < abstractParts.length; i++) {
      const part = abstractParts[i];
      const labelMatch = part.match(/Label="([^"]+)"/);
      const textMatch = part.match(/>([\s\S]*?)<\/AbstractText>/);
      if (textMatch) {
        const clean = stripXml(textMatch[1]);
        if (labelMatch) {
          abstractTexts.push(`${labelMatch[1]}: ${clean}`);
        } else {
          abstractTexts.push(clean);
        }
      }
    }
    const journal = extract(block, "Title") || extract(block, "ISOAbbreviation") || "";
    const year = extract(block, "Year") || "";

    const authorNames: string[] = [];
    const authorBlocks = block.split("<Author ").slice(1);
    for (const ab of authorBlocks.slice(0, 3)) {
      const last = extract(ab, "LastName") || "";
      const initials = extract(ab, "Initials") || "";
      if (last) authorNames.push(`${last} ${initials}`);
    }
    if (authorBlocks.length > 3) authorNames.push("et al.");

    const doiMatch = block.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/);
    const pmcMatch = block.match(/<ArticleId IdType="pmc">([^<]+)<\/ArticleId>/);

    articles.push({
      pmid,
      title,
      authors: authorNames.join(", "),
      journal,
      year,
      abstract: abstractTexts.join("\n\n"),
      doi: doiMatch?.[1] || "",
      pmcid: pmcMatch?.[1] || undefined,
    });
  }

  return articles;
}

export async function convertToPMC(
  pmids: string[]
): Promise<Record<string, string>> {
  if (pmids.length === 0) return {};

  const data = await fetchJson<{
    records?: Array<{ pmid?: string; pmcid?: string }>;
  }>(
    `https://www.ncbi.nlm.nih.gov/pmc/utils/idconv/v1.0/?${qs({
      ids: pmids.join(","),
      format: "json",
    })}`,
    "PMC ID conversion"
  );
  const map: Record<string, string> = {};
  for (const rec of data.records ?? []) {
    if (rec.pmid && rec.pmcid) map[rec.pmid] = rec.pmcid;
  }
  return map;
}

export async function fetchFullText(pmcid: string): Promise<string> {
  const xml = await fetchText(
    `${BASE}/efetch.fcgi?${qs({
      db: "pmc",
      id: pmcid,
      rettype: "xml",
      retmode: "xml",
    })}`,
    "PMC full text"
  );
  const bodyMatch = xml.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  if (!bodyMatch) return "";
  return stripXml(bodyMatch[1]).slice(0, 8000);
}

function extract(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? stripXml(match[1]) : null;
}
