export type Source = "pubmed" | "pmc" | "openalex" | "tavily";

export interface WorkflowStep {
  id: string;
  label: string;
  status: "pending" | "active" | "complete" | "error";
  detail?: string;
  artifactId?: string;
  sources?: Source[];
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  { id: "strategy", label: "Search Strategy", status: "pending", artifactId: "search_strategy" },
  { id: "search", label: "Source Search", status: "pending" },
  { id: "metadata", label: "Article Metadata", status: "pending" },
  { id: "screen", label: "Screening", status: "pending", artifactId: "screening_log" },
  { id: "fulltext", label: "Full-Text Retrieval", status: "pending" },
  { id: "summaries", label: "Article Summaries", status: "pending", artifactId: "article_summaries" },
  { id: "table", label: "Evidence Table", status: "pending", artifactId: "evidence_table_md" },
  { id: "synthesis", label: "Narrative Synthesis", status: "pending", artifactId: "narrative_synthesis" },
];

export interface StreamEvent {
  type: "step" | "artifact" | "error" | "done" | "cancelled" | "incomplete";
  stepId?: string;
  status?: "active" | "complete" | "error";
  detail?: string;
  artifactId?: string;
  artifactLabel?: string;
  filename?: string;
  content?: string;
  source?: Source;
  missing?: string[];
}

export interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string;
  journal: string;
  year: string;
  abstract: string;
  doi: string;
  pmcid?: string;
}

export interface ScreeningDecision {
  pmid: string;
  title: string;
  decision: "include" | "exclude";
  reason: string;
}

export interface Artifact {
  id: string;
  label: string;
  content: string;
  filename: string;
}

export const REQUIRED_ARTIFACT_IDS = [
  "search_strategy",
  "screening_log",
  "article_summaries",
  "evidence_table_md",
  "evidence_table_csv",
  "narrative_synthesis",
] as const;

export type RequiredArtifactId = (typeof REQUIRED_ARTIFACT_IDS)[number];
