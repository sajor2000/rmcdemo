"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import WorkflowProgress from "@/components/WorkflowProgress";
import ArtifactPanel from "@/components/ArtifactPanel";
import { WORKFLOW_STEPS, REQUIRED_ARTIFACT_IDS } from "@/lib/types";
import type { WorkflowStep, StreamEvent, Artifact, Source } from "@/lib/types";

const EXAMPLES = [
  "Do GLP-1 receptor agonists reduce the risk of stroke in patients with type 2 diabetes?",
  "What is the evidence for immunotherapy in early-stage non-small cell lung cancer?",
  "Does continuous glucose monitoring improve outcomes in type 1 diabetes?",
];

type RunOutcome = "idle" | "running" | "done" | "incomplete" | "cancelled" | "error";

interface AppConfig {
  openrouter: boolean;
  model: string;
  pubmed: boolean;
  openalex: boolean;
  openalexEnhanced: boolean;
  tavily: boolean;
  demoTokenRequired: boolean;
}

const VALID_EVENT_TYPES: ReadonlySet<StreamEvent["type"]> = new Set([
  "step",
  "artifact",
  "error",
  "done",
  "cancelled",
  "incomplete",
]);

function isStreamEvent(value: unknown): value is StreamEvent {
  if (!value || typeof value !== "object") return false;
  const t = (value as { type?: unknown }).type;
  return typeof t === "string" && VALID_EVENT_TYPES.has(t as StreamEvent["type"]);
}

export default function Home() {
  const [question, setQuestion] = useState("");
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [allowWebSearch, setAllowWebSearch] = useState(false);
  const [steps, setSteps] = useState<WorkflowStep[]>(
    WORKFLOW_STEPS.map((s) => ({ ...s }))
  );
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<RunOutcome>("idle");
  const [outcomeDetail, setOutcomeDetail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Synchronous guard against rapid double-submit. State updates are
  // batched/async in React 18; a fast double-click on Start can otherwise
  // launch two concurrent fetches before the first `setRunning(true)` lands.
  const runningRef = useRef(false);
  const running = outcome === "running";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AppConfig | null) => {
        if (!cancelled && data) setConfig(data);
      })
      .catch(() => {
        // Config endpoint is informational; UI still works without it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function parseStreamEvent(payload: string): StreamEvent | null {
    try {
      const event = JSON.parse(payload);
      return isStreamEvent(event) ? event : null;
    } catch {
      // Preserve existing progress if a single event arrives malformed.
      return null;
    }
  }

  function mergeSources(existing: Source[] | undefined, next?: Source): Source[] | undefined {
    if (!next) return existing;
    if (!existing) return [next];
    return existing.includes(next) ? existing : [...existing, next];
  }

  const startResearch = useCallback(
    async (q?: string) => {
      const input = q || question;
      // Synchronous guard against double-submit. The outcome-state read
      // below is async; only the ref is reliable for an immediate guard.
      if (!input.trim() || runningRef.current) return;
      if (!privacyConfirmed) {
        setError("Please confirm the question contains no PHI or patient identifiers.");
        return;
      }

      // Abort any prior in-flight run before starting a new one. Defensive —
      // the ref guard above should prevent this in normal use, but if a
      // previous run errored without clearing the controller we want to
      // tear it down explicitly.
      abortRef.current?.abort();

      runningRef.current = true;
      setOutcome("running");
      setOutcomeDetail(null);
      setError(null);
      setArtifacts([]);
      setActiveArtifactId(null);
      setSteps(WORKFLOW_STEPS.map((s) => ({ ...s })));

      const controller = new AbortController();
      abortRef.current = controller;

      // Track whether the server emitted a terminal event. If the stream
      // closes without one (proxy drop, mid-flight server crash), we
      // surface an error rather than leaving the UI stuck on "Researching".
      let receivedTerminal = false;

      try {
        const res = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: input, allowWebSearch }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setOutcome("error");
          setError(data?.error || `API error: ${res.status}`);
          receivedTerminal = true;
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setOutcome("error");
          setError("Streaming response unavailable");
          receivedTerminal = true;
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done: streamDone, value } = await reader.read();
          if (streamDone) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const event = parseStreamEvent(line.slice(6));
            // Silently skip malformed events. Heartbeats, retries, and
            // unknown future event types should not surface a user-facing
            // warning that overwrites a real error already on screen.
            if (!event) continue;

            if (event.type === "step" && event.stepId) {
              setSteps((prev) =>
                prev.map((s) =>
                  s.id === event.stepId
                    ? {
                        ...s,
                        status: event.status || s.status,
                        detail: event.detail || s.detail,
                        sources: mergeSources(s.sources, event.source),
                      }
                    : s
                )
              );
            }

            if (event.type === "artifact" && event.artifactId && event.content) {
              const newArtifact: Artifact = {
                id: event.artifactId,
                label: event.artifactLabel || event.artifactId,
                content: event.content,
                // Prefer the filename emitted by the server (matches the
                // tool call's saveArtifact.filename). Fall back to a
                // derived name only if the server omitted it.
                filename: event.filename || `${event.artifactId}.md`,
              };

              setArtifacts((prev) => [
                ...prev.filter((a) => a.id !== event.artifactId),
                newArtifact,
              ]);

              setActiveArtifactId(event.artifactId);
            }

            if (event.type === "error") {
              setOutcome("error");
              setError(event.detail || "Unknown error");
              receivedTerminal = true;
            }

            if (event.type === "cancelled") {
              setOutcome("cancelled");
              setOutcomeDetail(event.detail || "Research cancelled");
              // Clear any earlier transient error so the cancellation
              // banner is the single source of truth for the outcome.
              setError(null);
              receivedTerminal = true;
            }

            if (event.type === "incomplete") {
              setOutcome("incomplete");
              setOutcomeDetail(event.detail || "Research stopped before completion");
              setError(null);
              receivedTerminal = true;
            }

            if (event.type === "done") {
              setOutcome("done");
              setOutcomeDetail(null);
              receivedTerminal = true;
            }
          }
        }

        if (!receivedTerminal) {
          setOutcome("error");
          setError(
            "Connection closed before research completed. The server may have timed out — try again or simplify the question."
          );
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setOutcome("cancelled");
          setOutcomeDetail("Research cancelled");
          setError(null);
        } else {
          setOutcome("error");
          setError(err instanceof Error ? err.message : "Connection error");
        }
      } finally {
        runningRef.current = false;
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
      }
    },
    [allowWebSearch, privacyConfirmed, question]
  );

  function handleCancel() {
    abortRef.current?.abort();
  }

  function downloadAll() {
    // Browsers throttle / drop synchronous burst downloads (Chrome typically
    // collapses >1 download triggered in the same task). Stagger by 100ms
    // and revoke each blob URL well after the download starts so the file
    // dialog still has the object available when it opens.
    artifacts.forEach((artifact, index) => {
      window.setTimeout(() => {
        const blob = new Blob([artifact.content], {
          type: "text/plain;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = artifact.filename;
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      }, index * 100);
    });
  }

  const completedSteps = steps.filter((s) => s.status === "complete").length;
  const totalRequiredArtifacts = REQUIRED_ARTIFACT_IDS.length;
  const artifactIds = new Set(artifacts.map((a) => a.id));
  const showResults = outcome !== "idle";
  const isDone = outcome === "done";
  const isIncomplete = outcome === "incomplete";
  const isCancelled = outcome === "cancelled";

  const sourceIndicators: Array<{
    key: string;
    label: string;
    enabled: boolean;
    tone: "default" | "muted";
    hint: string;
  }> = [
    {
      key: "pubmed",
      label: "PubMed",
      enabled: config?.pubmed ?? true,
      tone: "default",
      hint: "Free biomedical evidence",
    },
    {
      key: "openalex",
      label: config?.openalexEnhanced ? "OpenAlex+" : "OpenAlex",
      enabled: config?.openalex ?? true,
      tone: "default",
      hint: config?.openalexEnhanced
        ? "Free scholarly metadata (API key configured)"
        : "Free scholarly metadata (no key required)",
    },
    {
      key: "tavily",
      label: "Tavily",
      enabled: Boolean(config?.tavily) && allowWebSearch,
      tone: "muted",
      hint: config?.tavily
        ? allowWebSearch
          ? "Optional web search enabled"
          : "Available as backup (toggle below)"
        : "Not configured",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Input Section */}
      <section className="mb-8">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {config?.model && (
              <span
                title={`OpenRouter model: ${config.model}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full border bg-gray-50 text-gray-700 border-gray-200"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                {config.model.split("/").pop() || config.model}
              </span>
            )}
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Sources
            </span>
            {sourceIndicators.map((indicator) => (
              <span
                key={indicator.key}
                title={indicator.hint}
                className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full border transition-colors ${
                  indicator.enabled
                    ? indicator.tone === "default"
                      ? "bg-primary-50 text-primary-700 border-primary-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                    : "bg-gray-50 text-gray-400 border-gray-200"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    indicator.enabled ? "bg-current" : "bg-gray-300"
                  }`}
                />
                {indicator.label}
              </span>
            ))}
            {config && !config.openrouter && (
              <span className="inline-flex items-center text-[11px] font-medium px-2 py-1 rounded-full border bg-red-50 text-red-700 border-red-200">
                OpenRouter key missing
              </span>
            )}
          </div>

          <label
            htmlFor="question"
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            Research Question
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                startResearch();
              }
            }}
            placeholder="Type a clinical research question..."
            rows={3}
            disabled={running}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50 resize-none"
          />

          <div className="mt-4 grid gap-3 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
            <label className="flex items-start gap-3 text-xs text-blue-900">
              <input
                type="checkbox"
                checked={privacyConfirmed}
                onChange={(e) => setPrivacyConfirmed(e.target.checked)}
                disabled={running}
                className="mt-0.5 h-4 w-4 rounded border-blue-300 text-primary-600 focus:ring-primary-500"
              />
              <span>
                I confirm this demo question contains no PHI, patient identifiers,
                MRNs, dates of birth, phone numbers, or emails.
              </span>
            </label>
            <label className="flex items-start gap-3 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={allowWebSearch}
                onChange={(e) => setAllowWebSearch(e.target.checked)}
                disabled={running}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span>
                Allow supplementary web search. Leave off for a PubMed-grounded
                classroom demo.
              </span>
            </label>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQuestion(ex);
                    startResearch(ex);
                  }}
                  disabled={!privacyConfirmed || running}
                  className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-500 hover:border-primary-300 hover:text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-50"
                >
                  {ex.length > 60 ? ex.slice(0, 57) + "..." : ex}
                </button>
              ))}
            </div>

            <div className="flex gap-2 shrink-0 ml-4">
              {running && (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => startResearch()}
                disabled={!question.trim() || !privacyConfirmed || running}
                className="px-6 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {running ? "Researching..." : "Start Research"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      {showResults && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Workflow Steps */}
          <aside className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700">
                Workflow
              </h2>
              <span className="text-xs text-gray-400">
                {completedSteps}/{steps.length}
              </span>
            </div>
            <WorkflowProgress
              steps={steps}
              artifactIds={artifactIds}
              onStepClick={(artifactId) => setActiveArtifactId(artifactId)}
            />

            {isDone && (
              <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-xs font-semibold text-green-800">
                    Run complete &middot; {artifacts.length}/{totalRequiredArtifacts} artifacts
                  </p>
                </div>
              </div>
            )}

            {isIncomplete && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs font-semibold text-amber-800">
                  Incomplete run &middot; {artifacts.length}/{totalRequiredArtifacts} artifacts
                </p>
                {outcomeDetail && (
                  <p className="text-[11px] text-amber-700 mt-1">{outcomeDetail}</p>
                )}
              </div>
            )}

            {isCancelled && (
              <div className="mt-4 p-3 rounded-lg bg-gray-50 border border-gray-200">
                <p className="text-xs font-semibold text-gray-700">Run cancelled</p>
                {outcomeDetail && (
                  <p className="text-[11px] text-gray-500 mt-1">{outcomeDetail}</p>
                )}
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-xs font-semibold text-red-800">
                  {outcome === "error" ? "Error" : "Warning"}
                </p>
                <p className="text-[11px] text-red-700 mt-1">{error}</p>
              </div>
            )}

            {artifacts.length > 0 && (isDone || isIncomplete || isCancelled) && (
              <button
                onClick={downloadAll}
                className={`mt-4 w-full px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  isDone
                    ? "bg-success-600 hover:bg-success-500"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download {artifacts.length} {artifacts.length === 1 ? "file" : "files"}
              </button>
            )}
          </aside>

          {/* Artifact Viewer */}
          <div>
            {artifacts.length > 0 ? (
              <ArtifactPanel
                artifacts={artifacts}
                activeId={activeArtifactId}
                onSelectArtifact={setActiveArtifactId}
              />
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-6 h-6 text-primary-600 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">
                  Searching PubMed{config?.openalex ? " + OpenAlex" : ""}...
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Artifacts will appear here as each step completes
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {outcome === "idle" && (
        <section className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-primary-100 flex items-center justify-center mx-auto mb-6">
            <svg
              className="w-8 h-8 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            AI-Assisted Literature Review
          </h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto mb-2">
            Type a clinical research question and the agent will search PubMed
            and OpenAlex, screen articles, and build an evidence synthesis
            with real, verifiable citations.
          </p>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            OpenRouter-powered agent &middot; PubMed + OpenAlex are free
            databases &middot; Every PMID and DOI is real — not hallucinated.
          </p>
        </section>
      )}

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-400">
          Research Agent Demo &middot; Rush Medical College &middot; AI-assisted,
          not AI-authored &middot; All citations require verification
        </p>
      </footer>
    </div>
  );
}
