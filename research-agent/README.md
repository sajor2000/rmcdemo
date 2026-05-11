# Research Agent Demo

A Next.js classroom demo that turns a clinical research question into a structured, AI-assisted literature review workflow. The agent runs through [OpenRouter](https://openrouter.ai/) (single required API key), pulls evidence from free scholarly sources — [PubMed](https://pubmed.ncbi.nlm.nih.gov/) E-utilities and [OpenAlex](https://openalex.org/) — and optionally calls [Tavily](https://tavily.com/) for supplementary web context. The streaming UI shows each step and artifact as the agent produces it.

## What It Demonstrates

- How a clinical question becomes a PICO-style search strategy.
- How an agent can use tools instead of relying only on model memory.
- How free databases (PubMed + OpenAlex) can be composed without extra cost.
- Why citations, PMIDs, DOI links, and generated claims still need human verification.
- How to build a transparent workflow UI with visible checkpoints and downloadable artifacts.

## Tech Stack

| Layer       | Tool                                       | Status                                          |
|-------------|--------------------------------------------|-------------------------------------------------|
| LLM gateway | OpenRouter (default: Claude Sonnet 4.5)    | **Required** API key, model is overridable      |
| Biomedical  | PubMed / PMC E-utilities                   | Free, no key. Built-in one-retry-with-backoff handles transient 429/5xx. |
| Scholarly   | OpenAlex `/works` API                      | Free tier covers all classroom use (key optional, recommended) |
| Web backup  | Tavily Search                              | Optional, only when UI toggle is on             |
| Hosting     | Next.js 15 app router on Vercel            | Hobby (60s function cap) is **not** enough; Pro/Fluid Compute supports the 800s `maxDuration` we use. Local-only is the recommended demo path. |

### OpenAlex free-tier budget

The OpenAlex free tier gives $1/day of usage. Our access pattern stays well inside it:

| Action | Free quota / day | Our usage per run | Headroom |
|---|---|---|---|
| Get single entity (e.g. `/works/doi:X`) | **unlimited** | 0–5 verifications | infinite |
| List+filter (our default search path) | 10,000 calls | ~1 search + ~1 batch DOI | ~5,000 runs/day |
| Search (`?search=...` — we don't use) | 1,000 calls | 0 | n/a |
| Content download (PDFs — we use PMC instead) | 100 | 0 | n/a |

The OpenAlex helper deliberately uses the cheap Filter-tier path (`filter=default.search:...`) instead of the Search-tier path so the free quota is effectively impossible to exhaust during teaching.

### Model selection (cost vs quality)

The default is **`anthropic/claude-sonnet-4.5`** — same price as Sonnet 4 but newer, and currently the strongest mid-tier model for agentic tool use. Override with `OPENROUTER_MODEL` if you want to trade quality for cost:

| Model | Approx. cost / run* | Use case |
|-------|---------------------|----------|
| `anthropic/claude-sonnet-4.5` (default) | ~$0.60 | Live classroom demo |
| `anthropic/claude-haiku-4.5` | ~$0.20 | Rehearsals and dry runs |
| `openai/gpt-5` | ~$0.29 | Cross-vendor sanity check |
| `openai/gpt-5-mini` | ~$0.06 | Dev iteration |

\*Rough estimate based on a typical 8-step run (~150k input / ~10k output tokens). Actual cost depends on how chatty the agent is on a given question.

## Setup

```bash
npm install
cp .env.local.example .env.local
```

Required:

```bash
OPENROUTER_API_KEY=...
```

Optional (improves quality / reliability or switches model):

```bash
OPENROUTER_MODEL=...     # See "Model selection" above. Defaults to anthropic/claude-sonnet-4.5.
OPENALEX_API_KEY=...     # Polite-pool email key, lifts OpenAlex quota
TAVILY_API_KEY=...       # Enables the "Allow supplementary web search" toggle
DEMO_ACCESS_TOKEN=...    # If set, clients must send x-demo-token to call /api/research
```

## Run Locally

```bash
npm run dev
```

Open the local URL Next.js prints. The recommended classroom prompt is:

```text
Do GLP-1 receptor agonists reduce the risk of stroke in patients with type 2 diabetes?
```

Before starting, tick the no-PHI confirmation. Leave supplementary web search off for the cleanest PubMed + OpenAlex demo.

## Expected Workflow

The left-side workflow progresses from top to bottom. Each step shows a source badge (PubMed / PMC / OpenAlex / Tavily) once the agent uses that tool:

1. Search Strategy
2. Source Search (PubMed + OpenAlex called in parallel)
3. Article Metadata
4. Screening
5. Full-Text Retrieval (PMC)
6. Article Summaries
7. Evidence Table (markdown + CSV)
8. Narrative Synthesis

The 8 visible steps produce 6 downloadable artifacts (search strategy, screening log, article summaries, evidence table markdown, evidence table CSV, narrative synthesis). Completed steps show green checkmarks. The bottom banner says:

- **Run complete · 6/6 artifacts** when the agent finishes the full workflow.
- **Incomplete run · N/6 artifacts** when the agent stops early — partial artifacts can still be downloaded.
- **Run cancelled** when the user aborts.

### Reliability behavior

PubMed / PMC / OpenAlex calls are wrapped with a 20-second timeout and one automatic retry-with-2s-backoff for transient failures (HTTP 429, 5xx, and TimeoutError). When NCBI rate-limits us mid-run — common during back-to-back demo rehearsals — you will see lines like the following in the server log:

```text
[PMC full text] HTTP 429, retrying after 2000ms
```

These are informational, not errors. The run keeps going and recovers transparently. A real failure shows up as a `stream-error` log line with a non-empty `cause=...` chain.

A typical canonical run completes in **5–7 minutes**. The 800s `maxDuration` headroom is intentional: it absorbs PMC rate-limit retries without ever pushing the run past the function cap.

## Deploy to Vercel (optional)

The recommended path for the Rush demo is **local-only** — see [`docs/instructor-runbook.md`](./docs/instructor-runbook.md) — because the entire workflow runs against free APIs from the instructor's laptop and the cold-start / function-cap risks of serverless aren't worth the convenience for a single one-hour class.

If you do deploy to Vercel:

- `vercel.json` pins the research route to an 800-second function timeout.
- The `/api/research` route declares `export const maxDuration = 800` to match.
- `next.config.ts` pins `outputFileTracingRoot` so multiple lockfiles in parent directories do not confuse the build.

Setup steps:

1. Push the `research-agent` folder to a new Git repo or `vercel link` from this directory.
2. In Vercel project settings, set the env vars from `.env.local.example`. `OPENROUTER_API_KEY` is the only required one.
3. The 800-second timeout requires Vercel Pro with Fluid Compute enabled. Hobby caps at 60s, which is **not enough** for a real research run. On Hobby, runs will be killed mid-workflow.
4. Deploy. Sanity-check the deployed app by sending the canonical question with web search disabled.

## Classroom Cautions

- Do not enter PHI, MRNs, dates of birth, phone numbers, emails, or other patient identifiers.
- This is educational software, not medical advice.
- AI-assisted does not mean publication-grade.
- Students must verify PMID and DOI links manually.
- Source coverage is limited to enabled databases — this is not a full systematic review.
- No dual independent screening is performed.
- Web search, if enabled, is supplementary context and not primary evidence.

## Verification Before Class

Run this once before teaching:

```bash
npm run build
```

Then run the app locally and confirm:

- All 8 workflow steps complete and the bottom banner says **Run complete · 6/6 artifacts**.
- PubMed and OpenAlex source badges appear on the relevant steps.
- The search strategy and evidence table are understandable.
- At least 2-3 PMID/DOI citations open correctly in a new tab.
- The total runtime fits your lesson plan (typical: 5–7 minutes).
- You have screenshots or cached outputs ready in case live APIs are slow.

### Demo-ready snapshot

The `demo-ready` git tag points at the last commit verified end-to-end (three back-to-back canonical runs, 6/6 artifacts each, NCBI 429 retries handled transparently). If anything breaks between now and class:

```bash
git checkout demo-ready          # look around safely
git reset --hard demo-ready      # only if you're sure
```

Backup artifacts from the verified run are also kept on the instructor laptop at `~/Desktop/demo-backup-artifacts/` — open these directly if a live run ever fails during class.

## Key Files

- `src/app/page.tsx` — Client UI, SSE parsing, privacy controls, source indicators, artifact state.
- `src/app/api/research/route.ts` — Streaming agent route with PHI gate, rate limits, source ordering, cancellation.
- `src/app/api/config/route.ts` — Reports which optional integrations are configured (used for UI badges).
- `src/lib/tools.ts` — AI SDK tools exposed to the agent (PubMed, OpenAlex, Tavily, saveArtifact).
- `src/lib/pubmed.ts` — PubMed and PMC helper functions.
- `src/lib/openalex.ts` — OpenAlex `/works` helper with inverted-abstract decoding.
- `src/components/WorkflowProgress.tsx` — Top-to-bottom visual workflow timeline with source badges.
- `src/components/ArtifactPanel.tsx` — Artifact tabs, markdown rendering, downloads.
- `src/components/SourceBadge.tsx` — Small per-source provenance badges.
- `vercel.json` — Function duration pin for the research route.
