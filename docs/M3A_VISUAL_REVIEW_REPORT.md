# Milestone 3A follow-on — objective QA and visual review gate

Date: 2026-11-12 · Status: implementation and regression tests complete; all 10 pages rendered and inspected, with formal human sign-off still pending.

## Delivered

- QA now checks bounds for text, shapes, pictures, chart frames, and connectors; overlapping text boxes; non-footer text under 9.5 pt; theme contrast; chart labels; chart/workbook agreement; and source state. Findings distinguish machine-checkable errors/warnings from geometry review signals and subjective human prompts.
- Font-substitution risk is explicitly surfaced for target-machine review; file metadata cannot prove which fonts PowerPoint actually substituted.
- Preview supports `auto`, `powerpoint`, or `libreoffice`, with timeout/error records and fallback from PowerPoint COM to LibreOffice on Windows. A `.preview.json` records the renderer, per-page PNGs and current PPTX hash only after successful rendering.
- QA rejects stale preview image references by comparing the exact PPTX SHA-256. A human review command records approve/change requests per slide, reviewer and note. Decisions are tied to the deck hash and the report remains incomplete until every rendered page has a decision.
- Regression tests cover overlap/bounds/font-size logic, renderer selection, editable architecture shapes, and stale/incomplete review decisions.

## Verification

| Check | Result |
|---|---|
| `npm test` | Passed: 74 tests, 0 failures (run inside `npm run check`). |
| `npm run check` | Passed: dependency audit, all 74 tests, critic evaluation, importer/validator/build/QA fixtures, repeated-run and dual-edition workflows. |
| Synthetic 10-slide deck build + structural QA | Passed with warnings; all text and object bounds pass, zero text-box overlap pairs, zero small-text findings, one native chart with exact workbook values, and expected unverified-evidence warnings. The cover decoration was brought inside the canvas. |
| Current Windows preview | Passed: PowerPoint 16.0 exported PDF and Poppler 26.07 rendered all 10 pages. Every PNG was visually inspected; no clear clipping or unintended overlap was seen. The review remains pending because no human reviewer has recorded a decision. |

## Limits

Machine checks cannot assess semantic image-to-claim fit, visual hierarchy, or actual font substitution. Rendered-page inspection by the assistant is documented, but the hash-bound slide decisions remain pending until a human reviewer records them. No user source material or external API is involved.
