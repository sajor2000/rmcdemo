import type { Source } from "@/lib/types";

const STYLES: Record<Source, string> = {
  pubmed: "bg-blue-50 text-blue-700 border-blue-200",
  pmc: "bg-sky-50 text-sky-700 border-sky-200",
  openalex: "bg-purple-50 text-purple-700 border-purple-200",
  tavily: "bg-amber-50 text-amber-700 border-amber-200",
};

const LABELS: Record<Source, string> = {
  pubmed: "PubMed",
  pmc: "PMC",
  openalex: "OpenAlex",
  tavily: "Tavily",
};

export default function SourceBadge({
  source,
  className = "",
}: {
  source: Source;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${STYLES[source]} ${className}`}
    >
      {LABELS[source]}
    </span>
  );
}
