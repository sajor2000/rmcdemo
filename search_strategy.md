# PubMed Search Strategy

**Date**: 2026-05-08
**Research Question**: Do GLP-1 receptor agonists reduce the risk of stroke in patients with type 2 diabetes?

---

## PICO Framework

| Element | Definition |
|---------|-----------|
| **P**opulation | Adults with type 2 diabetes mellitus (T2DM) or overweight/obesity |
| **I**ntervention | Glucagon-like peptide-1 receptor agonists (GLP-1 RAs): semaglutide, liraglutide, dulaglutide, tirzepatide, others |
| **C**omparison | Placebo, SGLT2 inhibitors, bariatric surgery, or standard of care |
| **O**utcome | Stroke, cerebrovascular events, MACE (major adverse cardiovascular events including non-fatal stroke) |

---

## MeSH Terms Identified

| Concept | MeSH Heading | Rationale |
|---------|-------------|-----------|
| Drug class | Glucagon-Like Peptide-1 Receptor Agonists | Controlled vocabulary for the drug class |
| Individual agents | semaglutide, liraglutide, dulaglutide | Major agents with cardiovascular outcome trial (CVOT) data |
| Outcome (primary) | Stroke | Direct target outcome |
| Outcome (broader) | Cardiovascular Diseases | Captures MACE endpoints that include stroke as a component |
| Cerebrovascular | cerebrovascular | Captures cerebrovascular disease and vascular dementia |
| Study design | Systematic Review; Meta-Analysis | Highest level of evidence for therapeutic questions |

---

## Boolean Search String

```
("GLP-1 receptor agonists"[Title] OR "glucagon-like peptide-1"[Title] OR 
"semaglutide"[Title] OR "liraglutide"[Title] OR "dulaglutide"[Title]) 
AND ("stroke" OR "cerebrovascular" OR "MACE" OR "cardiovascular outcomes") 
AND (systematic review[Publication Type] OR meta-analysis[Publication Type])
```

### Filters Applied
- **Date range**: 2022 to present
- **Publication type**: Systematic reviews and meta-analyses
- **Sort**: Publication date (newest first)
- **Maximum results**: 20

### Search Rationale
- Title field tags on drug names ensure specificity (avoids articles that mention GLP-1 RAs only in passing)
- Outcome terms searched in all fields to capture both primary stroke outcomes and MACE composites that include stroke
- Limited to systematic reviews and meta-analyses for highest-level evidence synthesis
- Date restriction (2022+) captures the most current evidence including recent CVOTs (SOUL, SURPASS-CVOT, FLOW, SELECT)

---

## Results Summary

- **Total records identified**: 166
- **Records retrieved for screening**: 20 (first page, sorted by publication date)
- **Database**: PubMed/MEDLINE via NCBI E-utilities API
- **Search executed**: 2026-05-08 via Claude Code with PubMed MCP server

---

## Search Limitations

1. **Single database**: Only PubMed/MEDLINE was searched. A comprehensive systematic review would also search Embase, Cochrane CENTRAL, CINAHL, Web of Science, and grey literature
2. **Title restriction**: Drug names were restricted to title field, which may miss relevant articles where GLP-1 RAs are discussed in the abstract only
3. **Language**: No language restriction was applied, but PubMed indexes primarily English-language articles
4. **Date restriction**: Articles published before 2022 were excluded, which omits foundational CVOTs (LEADER, SUSTAIN-6) though these are captured within the included meta-analyses
