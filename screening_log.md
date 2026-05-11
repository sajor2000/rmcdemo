# Screening Log

**Date**: 2026-05-08
**Screener**: Claude Code (AI-assisted, requires human verification)

---

## PRISMA Flow Diagram

```
Records identified through PubMed search
(n = 166)
        |
        v
Records retrieved for title/abstract screening
(n = 20)
        |
        v
Records screened on title and abstract ──────> Records excluded (n = 12)
(n = 20)                                       Reasons:
        |                                         - Renal/CKD primary focus (n = 2)
        |                                         - Type 1 diabetes population (n = 1)
        |                                         - Heart failure primary outcome (n = 3)
        |                                         - PAD/limb outcomes only (n = 2)
        |                                         - Atrial fibrillation focus (n = 1)
        |                                         - Narrative review, not SR/MA (n = 1)
        |                                         - Duplicate theme already captured (n = 1)
        |                                         - SGLT2i combination, not GLP-1 RA alone (n = 1)
        v
Full-text eligibility assessment ─────────────> Full-text excluded (n = 0)
(n = 8)
        |
        v
Studies included in evidence synthesis
(n = 8)
        |
        ├── With PMC full text available (n = 5)
        └── Abstract only (n = 3)
```

---

## Inclusion Criteria

1. Systematic review or meta-analysis (quantitative synthesis required)
2. GLP-1 receptor agonist as primary intervention or comparator
3. Stroke, cerebrovascular events, or MACE (including stroke) as a reported outcome
4. Population includes adults with type 2 diabetes or overweight/obesity
5. Published 2022 or later
6. English language

## Exclusion Criteria

1. Animal-only studies without clinical data (exception: if paired with clinical SR)
2. Narrative reviews without quantitative pooling
3. Primary outcome limited to heart failure, renal, or peripheral artery disease without stroke/MACE data
4. Type 1 diabetes population exclusively
5. Pharmacokinetic or dose-finding studies only

---

## Per-Article Screening Decisions

### INCLUDED (n = 8)

| # | PMID | First Author | Year | Title (abbreviated) | Decision | Reason |
|---|------|-------------|------|---------------------|----------|--------|
| 1 | 41263069 | Michaelsen MK | 2025 | GLP-1 RA as Treatment of Nondiabetic Ischemic Stroke | INCLUDE | Directly addresses stroke outcomes with GLP-1 RA; 35 studies (31 preclinical + 4 clinical) |
| 2 | 41565576 | Hasebe M | 2026 | GLP-1 RA and CV Outcomes in Asian, Black/AA, and White Populations | INCLUDE | MACE outcomes (includes stroke) stratified by race; 9 RCTs, N=74,703 |
| 3 | 41619622 | Stefanou MI | 2026 | Effects of GLP-1 RA on Vascular Dementia | INCLUDE | Cerebrovascular outcome (vascular dementia); 7 RCTs, N=61,610 |
| 4 | 41761267 | Shokravi A | 2026 | Tirzepatide vs GLP-1 RA on CV Outcomes: NMA | INCLUDE | Reports non-fatal stroke separately; 11 trials with tirzepatide data |
| 5 | 41255131 | Yeo D | 2025 | GLP-1 RA Across All Health Outcomes in T2D: Umbrella Review | INCLUDE | Comprehensive umbrella review; drug-specific stroke estimates for liraglutide, dulaglutide |
| 6 | 41454299 | Ahmed AAO | 2025 | SGLT2i vs GLP-1 RA for MACE in T2D | INCLUDE | Head-to-head MACE comparison; 12 RCTs, N=99,261 |
| 7 | 41472878 | Tan S | 2025 | Semaglutide (oral/SC) on CV Outcomes | INCLUDE | Semaglutide-specific MACE and stroke analysis; 4 RCTs, N=19,663 |
| 8 | 41506923 | Cordova F | 2025 | Bariatric Surgery vs GLP-1 RA: CV Outcomes | INCLUDE | Comparative MACE reduction; 5 cohort studies, N=39,569 |

### EXCLUDED (n = 12)

| # | PMID | First Author | Title (abbreviated) | Decision | Reason |
|---|------|-------------|---------------------|----------|--------|
| 1 | 41644273 | -- | Cardiorenal Effects of GLP-1 RA in CKD | EXCLUDE | Primary focus on renal outcomes in CKD, not stroke |
| 2 | 42100257 | -- | Tirzepatide vs Semaglutide: Narrative Review | EXCLUDE | Narrative review (not systematic/quantitative), primarily glycemic and weight outcomes |
| 3 | 41848820 | -- | Renal Outcomes of GLP-1 RA Across CKD Stages | EXCLUDE | Renal outcomes focus; stroke not a reported endpoint |
| 4 | 41605813 | -- | GLP-1 RA and SGLT2i as Adjuncts to Insulin in T1D | EXCLUDE | Type 1 diabetes population (not T2D) |
| 5 | 41287923 | -- | GLP-1 RA for Prevention of New-Onset Heart Failure | EXCLUDE | Heart failure primary outcome without stroke data |
| 6 | 41644868 | -- | Comparing CV Outcomes: GLP-1 RA vs Bariatric Surgery | EXCLUDE | Duplicate theme (surgery vs GLP-1 RA already captured in PMID 41506923) |
| 7 | 41424191 | -- | GLP-1 RA and Limb Outcomes in PAD | EXCLUDE | Peripheral artery disease/limb outcomes only |
| 8 | 41349790 | -- | GLP-1 RA and Atrial Fibrillation Risk | EXCLUDE | Atrial fibrillation focus; stroke not directly analyzed |
| 9 | 41173128 | -- | GLP-1 RA in Obese Patients with HFpEF | EXCLUDE | Heart failure with preserved EF; no stroke outcome |
| 10 | 41117973 | -- | SGLT2i + GLP-1 RA Combination in T2D | EXCLUDE | Combination therapy safety/efficacy; GLP-1 RA not isolated |
| 11 | 41022246 | -- | GLP-1 RA and CV Outcomes in PAD | EXCLUDE | Peripheral artery disease primary focus |
| 12 | 41223488 | -- | GLP-1 RA for QoL and Mortality in HF | EXCLUDE | Heart failure quality of life; no stroke outcome |

---

## Screening Notes

- All screening was performed by AI (Claude Code) based on title, abstract, and publication type
- No dual independent human screening was performed (required by PRISMA for published systematic reviews)
- Screening decisions should be verified by a human reviewer before use in any academic submission
