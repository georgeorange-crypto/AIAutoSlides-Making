# Milestone 3A follow-on — synthetic AI Systems example

Date: 2026-11-12 · Branch: `dev` · Status: functional generation and structural checks passed; fresh rendered-page review blocked by PowerPoint COM.

## Delivered

- `examples/multimodal/technical-introduction.md`, `synthetic-latency.csv`, and `architecture.json` are explicitly synthetic/hypothetical inputs. `scripts/build-multimodal-demo.mjs` deterministically generates the 10-slide storyboard and evidence ledger; evidence hashes use the exact source bytes and every source remains `verified:false`.
- Two original CC0-1.0 demo SVGs are embedded as image objects, with human verification still false.
- New `architecture` slide type lays out groups, nodes, labels and directed connectors as native PowerPoint objects. The native chart uses the CSV's three values without statistical inference. Existing process slides provide the method flow; all slides have stable IDs, evidence references where factual, and speaker notes.
- QA report now exposes native shape and connector counts. Regression tests cover invalid diagram endpoints and native PPTX shape/connector generation.

## Verification

| Check | Result |
|---|---|
| `npm test` | Passed: 58 tests, including architecture validation, editable diagram XML and asset embedding. |
| `npm run check` | Passed with exit code 0, including dependency audit, test suite, critic evaluation, sample builds and structural QA. |
| Demo generation + `cli validate` | Passed: 10 slides; 3 warnings correctly identify unverified synthetic source records. |
| `src/qa.mjs` | Passed structural checks; 10 editable-text slides, 1 native chart, diagram shapes/connectors and 2 linked image assets appear in the PPTX lineage. QA status remains `warning` for synthetic evidence. |
| `npm run preview` for this deck | Did not complete: PowerPoint COM remained hung and produced no PDF/PNG. Therefore all 10 pages still need visual inspection after rendering becomes available. |

## Remaining Milestone 3A work

The requested multi-stage AI planner remains the existing opt-in, review-gated planner and was not called here. PDF and PNG outputs are not available for this demo yet; overlap, font substitution, contrast-at-render, small labels and image/claim semantic fit are not visually reviewed. The current fixture contains two original SVGs but no PNG/JPEG sample. Timeline, editable table/code layouts and broader visual-review categorization remain future work. No user data, cloud upload, paid API, or external source material was used.
