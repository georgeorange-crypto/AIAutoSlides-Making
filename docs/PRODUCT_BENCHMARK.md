# Presentation generator benchmark protocol

This is a measurement plan, **not a results report**. No competitor has been scored and no speed or quality advantage is claimed.

The first local update-pipeline measurement is recorded separately in [`M4_UPDATE_BENCHMARK.md`](M4_UPDATE_BENCHMARK.md). It covers only one synthetic repeated-run task and is not a competitor comparison or a substitute for the protocol below.

## Tasks and inputs

| Task | Controlled input | Required deliverable | Numerical data status |
|---|---|---|---|
| Research group talk, 8–10 slides | Synthetic latency CSV plus a short method/limitation brief | Claim-led talk, chart with units/sample counts, method and next experiment | Synthetic; visibly labeled |
| Investment committee, 5–7 slides | Public-company annual report or a wholly synthetic financial dataset; record exact edition and section | Thesis, drivers, downside/risk, assumptions, explicit decision ask | Must be sourced or synthetic; never mixed silently |
| Systems engineering talk, 8–10 slides | Public architecture description and synthetic request trace | Editable architecture/process diagram, fair baseline chart, limitations | Synthetic trace unless primary public measurements are cited |

Each benchmark package must pin input files by SHA-256 and record tool version, dependency lockfile, theme, page dimensions, renderer, machine, and date. Use the same task and time budget for every tool. Keep private research out of third-party services unless the owner separately authorizes it.

## Scoring rubric (100 points)

| Dimension | Weight | Observable criteria |
|---|---:|---|
| Scientific accuracy and provenance | 25 | Values match inputs; units/baselines/sample counts preserved; every factual slide has a valid source chain; uncertainty is not invented. |
| Narrative and logic | 20 | Audience and goal are clear; titles form a coherent sequence; each slide has one defensible point; limitations are visible. |
| Visual evidence and charts | 20 | Chart encodings are appropriate, labels are complete, axis treatment is fair, diagrams clarify rather than decorate. |
| Design consistency | 15 | Typography, spacing, color, alignment, and slide density are consistent and purposeful. |
| Readability and accessibility | 10 | Text is legible at projection size; contrast is adequate; meaning is not conveyed by color alone; images have descriptions. |
| Engineering delivery | 10 | PPTX has native editable text/shapes/charts; build is reproducible; second-run data update preserves source lineage. |

Hard failures invalidate the run: fabricated numbers/citations, broken provenance, a chart that changes source values, critical clipping, or image-only slides represented as editable. Report hard failures separately from the 100-point score.

## Measures to record

- First-run elapsed time and human repair minutes.
- Second-run update time after changing one input row.
- Exact-value fidelity and evidence-ID coverage (counts and denominator).
- Editable object counts by slides, chart frames, shapes, text runs, and raster pictures.
- Text overflow/contrast flags and manual visual defects by slide.
- Blind rubric scores from at least two reviewers; preserve individual ratings and disagreements.
- Tool/version/plan and whether network/API calls were used.

Do not enter numbers until the task has been performed and the evidence captured. A small benchmark is descriptive, not proof of population-level superiority.

## Record template

```text
run_id:
task:
input_sha256:
tool_and_version:
theme_and_renderer:
first_run_minutes:
repair_minutes:
second_run_minutes:
value_matches / values_checked:
valid_evidence_links / factual_slides:
slides / editable_text_slides / native_charts / raster_images:
overflow_flags / manual_visual_defects:
reviewer_scores (six dimensions):
hard_failure:
limitations:
```
