---
date: 2026-05-11
topic: post-demo-cost-optimization
status: deferred-until-post-demo
---

# Post-Demo Plan: Switch to a Cheaper OpenRouter Model

## Summary

After the live classroom demo lands successfully on `anthropic/claude-sonnet-4.5`, evaluate two cheaper OpenRouter models (`anthropic/claude-haiku-4.5` and `google/gemini-2.5-flash`) against the canonical query using the existing curl test harness. Adopt the cheapest model that passes the same 3-consecutive-clean-runs gate the original fix had to clear. Expected savings: 67–89 percent per run.

---

## Problem Frame

The current production path uses `anthropic/claude-sonnet-4.5` at $3 / $15 per million input/output tokens. Token shape from three validated end-to-end runs of the canonical "GLP-1 + stroke" query: **~422K input tokens and ~21K output tokens per run**, dominated by input replay across the agentic loop's 9 steps. That puts the current cost at **~$1.59 per run**. For a demo class plus several rehearsal and development runs, the monthly bill grows quickly. The bug-fix work that just landed (Zod cap, no-narration prompt, `maxTokens` raise) is model-agnostic — so the door is open to swapping in a cheaper model without re-doing any of that work, provided we validate the swap against the same gate.

This work is deliberately deferred until after the upcoming live classroom demo, because the current Sonnet 4.5 configuration has just passed three consecutive end-to-end validation runs and any model change reintroduces unknown-unknowns at exactly the wrong moment.

---

## Token-Shape Data (validated runs from 2026-05-11)

| Run | Input tokens | Output tokens |
|---|---|---|
| 1 | 410,717 | 19,340 |
| 2 | 434,672 | 21,877 |
| 3 | 420,755 | 22,116 |
| **Avg** | **~422K** | **~21K** |

Input dominates output 20:1. **Input price is what matters when picking a cheaper model.**

---

## Cost Comparison (current OpenRouter pricing, May 2026)

| Model | Input $/M | Output $/M | Cost / run | vs Sonnet 4.5 | Context | Triage |
|---|---|---|---|---|---|---|
| `anthropic/claude-sonnet-4.5` (current) | $3.00 | $15.00 | $1.59 | baseline | 1M | Where we are |
| `anthropic/claude-haiku-4.5` | $1.00 | $5.00 | $0.53 | −67% | 200K | **Test first** — same family |
| `openai/gpt-5-mini` | $0.25 | $2.00 | $0.15 | −91% | 400K | Test if Haiku fails |
| `google/gemini-2.5-flash` | $0.30 | $2.50 | $0.18 | −89% | 1M | **Test second** — best ratio |
| `google/gemini-2.5-flash-lite` | $0.10 | $0.40 | $0.05 | −97% | 1M | Capability-limited; risky |
| `openai/gpt-5-nano` | $0.05 | $0.40 | $0.03 | −98% | 400K | Too weak for medical research workflow |
| `openai/gpt-4o-mini` | $0.15 | $0.60 | $0.08 | −95% | **128K** | ⚠ Eliminated — context too tight |

Hard constraint: largest single prompt observed was **72,761 tokens** (final step). Need **≥ 200K context** for headroom, which eliminates every model in the 128K-context tier.

---

## Test Methodology (when you pick this back up)

Reuse the curl-based harness from 2026-05-11.

For each candidate:

1. Set `OPENROUTER_MODEL=<candidate>` in `research-agent/.env.local`.
2. Restart the dev server (`npm run dev`).
3. Run the canonical query three times back-to-back:

```bash
curl -sS -N -X POST http://localhost:3000/api/research \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the evidence that GLP-1 receptor agonists reduce stroke risk in patients with type 2 diabetes?","allowWebSearch":false}' \
  --max-time 360 > /tmp/sse-test.log 2>&1
grep -oE '"type":"[a-z]+"' /tmp/sse-test.log | sort | uniq -c
grep -oE '"artifactId":"[a-z_]+"' /tmp/sse-test.log | sort -u
```

4. Pass criteria (same gate the original fix had to clear): all three runs deliver six artifacts and emit `done`. Any `incomplete` or `error` terminal event is a fail.
5. **Spot-check artifact quality**, not just count: read at least one `evidence_table_md` and one `narrative_synthesis` from each candidate. Cheap models can pass the structural gate while producing thin or shallow scholarship.

---

## Decision Tree

- **Haiku 4.5 passes structural gate AND quality spot-check** → adopt it. 67 percent savings, same model family, lowest behavior-drift risk. Stop testing.
- **Haiku 4.5 fails OR quality is thin** → test Gemini 2.5 Flash. If it passes both gates → adopt it (89 percent savings). If it fails → test GPT-5 mini. If all three fail → stay on Sonnet 4.5 and re-open this brainstorm with the failure logs.
- **Any candidate produces hallucinated citations** in the spot-check → automatic disqualification regardless of cost. This is a medical-education tool; fabricated PMIDs are a non-negotiable failure mode.

---

## Scope Boundaries

- Out of scope here: switching the orchestration framework (still Vercel AI SDK), switching providers off OpenRouter, adding model fallback logic, or A/B routing by query complexity. Those are bigger plays that should be a separate brainstorm.
- The 2000-character Zod cap, `maxTokens: 8000`, and no-narration system prompt rule are model-agnostic and stay regardless of which model is chosen.
- Quality spot-checks are subjective and brief — this is not a full evaluation harness. If the demo audience grows or the agent gets used outside the classroom, that becomes worth building.

---

## When to Trigger This Plan

After the live demo concludes successfully. No earlier. The marginal dollar of cost savings before the demo is not worth the marginal dollar of risk to known-good behavior.
