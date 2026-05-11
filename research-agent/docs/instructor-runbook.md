# Instructor Runbook: 1-Hour Research Agent Demo

## Session Goal

Students should leave understanding how an AI research agent is built, where it helps, and where medical learners still need to verify and critique the output.

## Canonical Demo Question

```text
Do GLP-1 receptor agonists reduce the risk of stroke in patients with type 2 diabetes?
```

Use this question because it is clinically recognizable, literature-rich, and produces a useful discussion about outcomes, systematic reviews, and evidence quality.

## Tech Stack At A Glance

| Layer       | Tool                                       | Status                                       |
|-------------|--------------------------------------------|----------------------------------------------|
| LLM gateway | OpenRouter (default: Claude Sonnet 4.5)    | **Required** API key, model overridable      |
| Biomedical  | PubMed / PMC E-utilities                   | Free, no key                                 |
| Scholarly   | OpenAlex `/works` API                      | Free-tier covers all classroom use           |
| Web backup  | Tavily Search                              | Optional, only when UI toggle is on          |

Source ordering inside the agent: **PubMed → PMC → OpenAlex (cross-check) → Tavily (optional)**.

OpenAlex free-tier budget: each run uses ~1 filter call (10,000/day quota) and 0 search calls. That's ~5,000 demo runs per day before hitting the free cap — see README for the full breakdown.

The model in use shows up as a gray pill next to the **Sources** strip in the UI. The default is `anthropic/claude-sonnet-4.5` for the live class. For rehearsals, set `OPENROUTER_MODEL=anthropic/claude-haiku-4.5` (~3x cheaper) — runs are noticeably faster and Haiku 4.5 still does tool calls reliably; the only tradeoff is slightly shallower narrative synthesis.

## Pre-Class Checklist

- Run `npm run build`.
- Run `npm run dev`.
- Confirm `OPENROUTER_API_KEY` is set in `.env.local`.
- Optional but recommended: set `OPENALEX_API_KEY` (any email-based free polite-pool key) for better quota during class.
- Leave supplementary web search off unless you specifically want to teach source-quality differences.
- Run the canonical question once and note runtime.
- Verify 2-3 DOI links manually.
- Verify the **Sources** indicator strip shows PubMed and OpenAlex as enabled, and Tavily as muted unless you intend to demonstrate it.
- Keep screenshots or a previously downloaded artifact set ready as a backup. This is required for a smooth class because live LLM/tool runs can stop early, time out, or produce incomplete artifacts.
- Confirm the workflow reaches **8/8 steps · 6/6 artifacts** before relying on the live run as the main demonstration.
- Confirm at least one PubMed and one OpenAlex source badge appears in the workflow during the run.

## 60-Minute Agenda

### 0-5 min: Frame The Problem

Teaching points:

- Medical students need fast ways to structure literature questions.
- Search strategy matters as much as synthesis.
- AI can accelerate workflow, but it cannot remove verification.

Say explicitly:

> This is AI-assisted, not AI-authored. Nothing here should be treated as medical advice or publication-grade evidence without human review.

### 5-15 min: Live Demo Run

Steps:

- Check the no-PHI box.
- Keep web search off.
- Start the canonical question.
- Narrate the vertical workflow as it progresses.
- Point out green checkmarks and artifacts appearing as the agent works.

If the run is slow:

- Explain that live tools depend on LLM and PubMed latency.
- Continue with the most recently completed artifact.
- Use backup screenshots or downloaded artifacts if needed.

### 15-25 min: Architecture Walkthrough

Show these files:

- `src/app/page.tsx`: the client listens to server-sent events and updates the workflow + source badges.
- `src/app/api/research/route.ts`: the server runs the agent, enforces source ordering, and streams progress.
- `src/lib/tools.ts`: the model gets bounded tools for PubMed, OpenAlex, PMC full text, optional web search, and artifact saving.
- `src/lib/pubmed.ts`: deterministic E-utilities calls provide real PMIDs, abstracts, DOIs, and PMC text.
- `src/lib/openalex.ts`: free OpenAlex `/works` lookup with inverted-abstract decoding, used to cross-check PubMed and surface open-access URLs.

Key concept:

> The agent is not just a chatbot. It is a model operating inside a constrained workflow with tools and deliverables.

### 25-40 min: Artifact Critique

Open the artifacts in this order:

1. Search Strategy - ask students to identify PICO elements and missing search terms.
2. Screening Log - discuss inclusion/exclusion criteria and PRISMA-like flow.
3. Evidence Table - inspect outcomes, effect sizes, and citation quality.
4. Narrative Synthesis - critique the bottom line and limitations.

Student prompts:

- What would you add to the search strategy?
- Which artifact would you trust least without manual verification?
- Where could bias enter the workflow?
- Did PubMed and OpenAlex agree on the included articles? When they disagreed, which source was right?
- Is PubMed + OpenAlex enough for this question, or would you want something else?

### 40-52 min: Student Exercise

Ask students to propose one clinical research question. As a group, improve it before running anything.

Use this checklist:

- Population
- Intervention/exposure
- Comparator
- Outcome
- Study type
- Date range

Then compare their improved question to the app's generated PICO/search strategy.

### 52-60 min: Takeaways

Close with:

- Agents are useful for structure, traceability, and first-pass synthesis.
- Tool grounding reduces but does not eliminate hallucination.
- Clinical and academic responsibility remains with the human.
- Verification of PMIDs, DOIs, study design, and effect sizes is mandatory.

## Backup Plan

If live APIs fail:

- Show the app UI and workflow states.
- Walk through previously downloaded artifacts.
- Ask students to critique the artifacts as if they were reviewing a classmate's evidence summary.

If the model produces incomplete artifacts:

- Use it as a teaching moment about workflow validation.
- Point out that the app reports an **Incomplete run** banner with the artifacts that did succeed, instead of pretending the review finished.
- Switch to the downloaded artifact set for the artifact-critique portion of class.

If the student cancels mid-run:

- The app shows a **Run cancelled** banner.
- Whatever artifacts were produced before cancellation remain downloadable.

## Observed Dry-Run Note

During prep, one live run generated only the Search Strategy artifact and then correctly surfaced an **Incomplete run · 1/6 artifacts** banner. Treat this as a feature of the teaching story: the UI has validation and does not falsely claim success. For the actual class, have a complete artifact set ready before starting.

## Post-Class Follow-Up Assignment

Ask students to submit:

- One improved PICO question.
- One PubMed query.
- One verified citation with PMID and DOI.
- A short note identifying one limitation of AI-assisted literature review.
