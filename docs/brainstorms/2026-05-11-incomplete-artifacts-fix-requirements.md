---
date: 2026-05-11
topic: incomplete-artifacts-fix
---

# Fix "Incomplete run · 1/6 artifacts" Before Live Classroom Demo

## Summary

Raise the AI SDK per-step output token cap, prune pre-tool-call narration from the system prompt, and **loosen the Zod `query` cap (500 → 2000 chars) on `pubmedSearch` and `openAlexSearch` so realistic biomedical queries with MeSH terms and Boolean operators pass validation**. Verified end-to-end across three consecutive canonical-query runs (6/6 artifacts each). Approach B (first-party Anthropic provider migration) was not needed and is no longer queued.

## Resolution note

The original Approach A diagnosis (per-step token truncation) was **wrong**. After enabling temporary `fullStream` error logging, the real root cause surfaced: an `AI_InvalidToolArgumentsError: String must contain at most 500 character(s)` on the `query` parameter. The AI SDK silently rejects oversize tool arguments without forwarding the error back to the model, so the model "thought" its `pubmedSearch` call had succeeded while no search had actually run — the workflow then stalled because the model had no PubMed results to screen. Bumping the Zod cap to 2000 (PubMed itself supports queries up to ~8000) restored the full agentic loop. The token-cap and no-narration changes from the original Approach A were kept (they don't hurt and the no-narration rule materially helps the model emit parallel tool calls), but they are not what fixed the bug.

---

## Problem Frame

The research agent stalls before completing its workflow, delivering only 1 of 6 required artifacts in a recent canonical run. Diagnostic logs from step 3 of a representative failure show the model emitting pre-tool-call narration ("Now let me search PubMed:") and then producing **no tool call** before the request closes — the OpenRouter provider reports `finishReason=tool-calls` with `tools=0`, a logical contradiction that indicates the model intended to call a tool but was cut off before assembling the JSON arguments.

This is blocking an upcoming 1-hour live classroom demo for medical students. The earlier hypothesis (that the OpenRouter provider's `flush()` was dropping unsent tool calls) was already addressed by upgrading `@openrouter/ai-sdk-provider` from 0.4.6 to 0.7.5. That upgrade was necessary but not sufficient: the post-upgrade retest reproduced the same failure, proving the truncation happens **upstream** of `flush()`, inside the model's response stream itself. The most plausible remaining cause is the AI SDK's default per-step output token allowance — left unset in our `streamText` call — being exhausted by Claude Sonnet 4.5's verbose pre-tool-call reasoning before the tool-call payload can be written.

---

## Requirements

**Surgical fix (Approach A)**
- R1. Set an explicit per-step output token cap on the `streamText` call that gives Claude Sonnet 4.5 enough headroom to emit pre-tool-call reasoning *and* a complete tool-call payload in a single step.
- R2. Add a directive to the system prompt instructing the model to suppress pre-tool-call narration and emit tool calls directly, reducing pressure on the per-step output budget.
- R3. Preserve the existing OpenRouter provider plugin, AI SDK version, model selection (Claude Sonnet 4.5), and overall agent loop semantics. No other infrastructure changes.

**Validation gate**
- R4. After the surgical fix lands, run the canonical "GLP-1 receptor agonists and stroke risk" query three consecutive times. The fix is considered to hold only if all three runs produce all six required artifacts. A single clean run is not sufficient evidence given the prior intermittent behavior.
- R5. If any of the three validation runs falls short of 6/6 artifacts, escalate to the first-party Anthropic provider plan in R6 rather than attempting additional surgical patches.

**Conditional escalation (Approach B — only if validation fails)**
- R6. Replace the OpenRouter provider plugin with the first-party `@ai-sdk/anthropic` provider, calling Claude Sonnet 4.5 directly with the team's Anthropic API key. The model, prompts, tools, and orchestration loop stay unchanged. Apply the same R1/R2 cap and prompt directives in this configuration.
- R7. After migration, run the same three-clean-runs validation gate from R4 before declaring the demo path ready.

---

## Acceptance Examples

- AE1. **Covers R1, R2, R4.** Given the surgical fix has been applied to `streamText` parameters and the system prompt, when an operator runs the canonical GLP-1 query three times in succession from the browser UI, all three runs deliver six required artifacts (`search_strategy`, `screening_log`, `article_summaries`, `evidence_table_md`, `evidence_table_csv`, `narrative_synthesis`) and the UI shows the success banner.
- AE2. **Covers R5, R6.** Given any of the three canonical-query validation runs delivers fewer than six artifacts, when the team decides next steps, the migration to the first-party `@ai-sdk/anthropic` provider is initiated rather than further patching the OpenRouter path.

---

## Success Criteria

- The live demo can be run end-to-end on the canonical query without operator intervention, producing all six artifacts every time across at least three consecutive trial runs in the 48 hours before the classroom session.
- A downstream agent or implementer reading this doc can choose Approach A vs Approach B unambiguously by checking the three-clean-runs gate, without re-litigating the diagnosis.

---

## Scope Boundaries

- Migrating to a different orchestration framework (Mastra, LangChain.js, raw `fetch` loop) is out of scope; the time cost is incompatible with the demo deadline and would introduce new failure surfaces.
- Switching to a different model (OpenAI GPT-5, Google Gemini, etc.) is out of scope; the system prompt and tool schemas are tuned for Claude Sonnet 4.5 and a model change would require a separate prompt audit we cannot complete in time.
- Adding the non-streaming `generateText` fallback path is out of scope unless both Approach A and Approach B fail their validation gates. It is held in reserve, not activated by default.
- Refactoring the SSE transport, the tool registry, the PHI gate, or the rate-limiting layer is out of scope for this work.
- Long-term provider/model strategy (post-demo cost optimization, multi-model A/B, evaluation harness) is a separate decision and out of scope here.

---

## Key Decisions

- **Approach A first, Approach B as gated escalation:** the surgical fix is reversible in seconds and addresses the diagnosed root cause directly. Migrating providers is a larger change whose value is conditional on A failing — committing to it upfront would be premature optimization.
- **Three-clean-runs validation gate, not one:** prior failures have been intermittent. A single clean run after the fix would be ambiguous evidence; three consecutive runs is the threshold that distinguishes "fixed" from "got lucky once".
- **Same model in both approaches:** keeping Claude Sonnet 4.5 in Approach B means the migration tests *only* the provider-plugin variable, not the model variable. If B passes after A fails, the provider plugin was the issue; we don't have to also ask "or was it the model?".
- **No fallback by default:** introducing a parallel non-streaming code path adds carrying cost and a second UX shape. We accept that cost only as a last resort, not as a prophylactic measure.

---

## Dependencies / Assumptions

- The team has, or can obtain within the demo timeline, an Anthropic API key with Claude Sonnet 4.5 access — required only if Approach B is triggered.
- Claude Sonnet 4.5's published per-call output token ceiling is high enough (well above the value chosen for R1) that raising the cap will not be silently re-truncated by the upstream API.
- The OpenRouter → AI SDK finish-reason mapping behavior diagnosed above is stable across runs, not a transient network or quota artifact. (If a retest after the fix reveals truly random truncation unrelated to token budget, the diagnosis is wrong and the brainstorm must reopen.)

---

## Outstanding Questions

### Deferred to Planning

- [Affects R1][Technical] What is the right value for the per-step output token cap given Claude Sonnet 4.5's pricing and the typical tool-args payload size? Initial bet is generous (high four-digit range), to be tuned during implementation review.
- [Affects R6][Needs research] If Approach B fires, are there any system-prompt or tool-schema patterns that depend on OpenRouter-specific request shapes and would not translate cleanly to the first-party Anthropic provider? Defer to the migration step.
