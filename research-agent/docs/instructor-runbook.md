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

## Local-Only Demo Setup (chosen deployment path)

For this 1-hour classroom session, the agent runs on the instructor's laptop, not on a hosted server. The instructor drives the demo and projects the laptop screen. This is the simplest, most reliable path — zero hosting cost, zero proxy-timeout risk, and the OpenRouter key never leaves the instructor's machine.

### Night before class

1. Pull the latest `main` branch: `git pull origin main`. Or, for the strongest guarantee, check out the verified snapshot: `git checkout demo-ready` (the tag points at the last commit verified end-to-end).
2. Reinstall dependencies cleanly: `cd research-agent && npm ci`.
3. Confirm `research-agent/.env.local` contains a working `OPENROUTER_API_KEY`. (Optional: also set `OPENALEX_MAILTO` to your school email for the OpenAlex polite pool.)
4. Run `npm run build` once. It must end with "Generating static pages (5/5)" and no type errors.
5. Run the canonical question once via the browser at `http://localhost:3000` to confirm 6/6 artifacts. This is the final pre-flight (~$1.60 in OpenRouter credits for Sonnet 4.5).
6. Download all six artifacts from that pre-flight run and save them at `~/Desktop/demo-backup-artifacts/` as a backup artifact set. A previous verified set is already there from the 2026-05-11 validation runs if you want a head-start.

### 15 minutes before class

1. Close other heavy apps (Slack, video calls, large IDE projects in other windows) to free RAM.
2. Plug the laptop into power. Do NOT rely on battery for a 5-minute streaming run.
3. Prevent the system from sleeping during the class. On macOS, open a terminal and run:

   ```
   caffeinate -d
   ```

   Leave that terminal open until class ends. On Windows, use the Power & Sleep settings to set "Plugged in, turn off after" to "Never" for the session.
4. Confirm wifi is stable on the room's network. The agent makes outbound calls to PubMed, OpenAlex, and OpenRouter — any of those failing mid-run will produce an "Incomplete" or "Network error" banner.
5. Start the dev server from the `research-agent/` directory:

   ```
   npm run dev
   ```

   Wait for the "Ready in" line, then open `http://localhost:3000` in your browser.
6. Hard-refresh the browser tab (Cmd+Shift+R on macOS, Ctrl+Shift+R on Windows) to drop any cached state.
7. Open a second terminal window with `tail -f` on the dev server output, sized so it is visible but not in the projection. The `[step]` lines provide a reassuring real-time backchannel if anything seems wrong on the projector.

### Optional: sharing a live URL with students

If students should be able to hit the same instance from their own laptops, add a free Cloudflare Tunnel in front of the local server.

1. Install once: `brew install cloudflared` on macOS, or download the binary from `https://github.com/cloudflare/cloudflared/releases`.
2. While the dev server is running, in a third terminal: `cloudflared tunnel --url http://localhost:3000`.
3. Cloudflared prints a `https://<random>.trycloudflare.com` URL. Share that with the class. The URL is valid as long as the tunnel process runs — when class ends, Ctrl+C the tunnel and the URL goes dead.

Notes on this path:
- The tunnel URL is unguessable but technically public. Use it for the class hour only.
- All traffic still terminates on your laptop, so all the same OpenRouter cost and wifi-dependency caveats apply.
- The trycloudflare.com domain has no idle timeout that matters for our SSE stream — events arrive at 30-60s intervals during a run, well inside any proxy limit.

### Day-of troubleshooting reference

| Symptom | Most likely cause | Quick fix |
|---|---|---|
| `[PMC full text] HTTP 429, retrying after 2000ms` in the server log | NCBI is rate-limiting us — common during back-to-back runs | **Not an error.** The retry-with-backoff layer recovers it automatically; the run keeps going. Don't mention this to the class unless they're watching the log over your shoulder. |
| "Network error" banner appears in seconds | Dev server crashed or was hot-reloaded mid-request | Check the server terminal. Restart with `npm run dev` if needed, hard-refresh browser. |
| "Incomplete run · N/6 artifacts" | A non-transient failure after the automatic retry already used its one chance — usually a malformed tool call, model truncation, or sustained OpenRouter/NCBI outage | Look at the server log for a `stream-error: name=... message=... cause={...}` line — that has the underlying error. Retry once; if reproducible, fall back to the backup artifact set at `~/Desktop/demo-backup-artifacts/`. |
| Browser shows the page but submit button does nothing | Server not running on :3000, or browser is on a stale URL | Confirm `npm run dev` is still up in the terminal. Refresh browser. |
| Stepper looks frozen for >90 seconds with no new event | Model is mid-synthesis (especially article_summaries or narrative_synthesis steps); these are the heaviest writes | Be patient — these steps often write 3000-5000 tokens. The terminal's `[step]` lines will confirm activity. |
| Browser says "Took too long to respond" or similar | Laptop went to sleep, lost network, or `caffeinate -d` was not started | Wake laptop, confirm wifi, restart dev server, fall back to backup artifacts. |

### After class

1. Ctrl+C the dev server, the `caffeinate -d` terminal, and any Cloudflare Tunnel.
2. The `.env.local` file with the OpenRouter key stays on the laptop and is gitignored — it never reaches GitHub.
3. If running cheaper-model evaluation post-class is on the roadmap, see `docs/brainstorms/2026-05-11-post-demo-cost-optimization-plan.md`.

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

## Validation Status (last verified 2026-05-11)

Four classes of bug were diagnosed and fixed during pre-class preparation on 2026-05-11. Each is documented below in the order it was caught:

| Bug | Root cause | Fix |
|---|---|---|
| Incomplete run · 1/6 artifacts (first occurrence) | 500-char Zod cap on `pubmedSearch`/`openAlexSearch` query parameters; AI SDK silently rejected over-long tool arguments | Cap raised to 2000 chars |
| Incomplete run on second canonical question | 5-element Zod cap on `pubmedFulltext.pmcIds`; model wanted 10 PMC IDs for a thorough review | Cap raised to 25 |
| Sudden hard failure under back-to-back-run load | NCBI PMC efetch returning HTTP 429; no retry layer, 12s timeout was tight | Added one-retry-with-2s-backoff to `pubmed.ts` and `openalex.ts`; timeout raised 12s → 20s |
| Stream-error log was `cause: {}` (useless) | `JSON.stringify` on `Error`/`DOMException` returns `{}` because the relevant properties are non-enumerable | Hand-written `serializeStreamError()` walks the chain and emits `name=... message=... cause={...}` |

Three consecutive end-to-end validation runs of the canonical GLP-1 question each produced 6/6 artifacts after the fixes landed:

| Run | Artifacts | Duration | Terminal event |
|---|---|---|---|
| 1 | 6/6 | 5:15 | done |
| 2 | 6/6 | 5:44 | done |
| 3 | 6/6 | 5:57 | done |

A fourth verification run on the second canonical question (NSCLC immunotherapy — the one that exposed the NCBI rate-limit bug) also produced **6/6 artifacts in 6:14**, with **6 PMC 429 retries transparently recovered** during the run.

**Plan for ~5–7 minutes wall time per run.** The 800s `maxDuration` headroom absorbs PMC retries without ever pushing close to the function cap.

Full diagnosis records:
- `docs/brainstorms/2026-05-11-incomplete-artifacts-fix-requirements.md` (Zod query cap)
- Git commit `d0f0235` ("Retry transient NCBI/OpenAlex failures + clearer error logs")
- Git tag `demo-ready` (latest fully-verified state)

The "Incomplete run" banner remains as a real safety net — if the agent does ever fail to deliver all six artifacts after the automatic retry has used its one chance, the UI will say so honestly rather than pretending the review finished. Treat any future incomplete-run banner as a teaching moment about workflow validation, not as a bug masquerading as success.

## Post-Class Follow-Up Assignment

Ask students to submit:

- One improved PICO question.
- One PubMed query.
- One verified citation with PMID and DOI.
- A short note identifying one limitation of AI-assisted literature review.
