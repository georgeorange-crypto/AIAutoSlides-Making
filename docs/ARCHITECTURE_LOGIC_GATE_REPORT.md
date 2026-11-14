# Architecture logic and label-layout gate

## Change

Legacy storyboard validation, canonical Presentation IR validation, AI planner review, and the formal Harness now share architecture graph checks. A diagram must have at least three specifically named components, at least two action-labeled directed links, connected topology, one or more entry and output nodes, and no repeated directed link. All components must be traversable from an entry toward an output. Directionless cycles and two-box links fail before the renderer is probed.

For diagrams with authored node geometry, the validator and renderer share a deterministic relationship-label placement routine. It reserves group headings and node rectangles, places editable labels without collisions, and rejects diagrams when all labels cannot fit inside the slide content area. The positive renderer test runs PPTX structural QA and requires zero text overlaps while confirming every relationship label and connector is present.

## Adversarial and rendered evidence

- `node --test tests/validate.test.mjs tests/ai-plan-contract.test.mjs tests/presentation-ir.test.mjs tests/presentation-harness.test.mjs tests/assets.test.mjs` — 67 passed, 0 failed. Cases include a missing relation, repeated arrows, directionless cycles, labels that cannot fit around authored geometry, and an invalid diagram rejected before renderer probing.
- `npm test` — 346 total, 335 passed, 0 failed, 11 optional integrations skipped.
- Reproducible synthetic build: `node src/cli.mjs build --input examples/multimodal/storyboard.json --evidence examples/multimodal/evidence.json --assets examples/multimodal/assets.json --out outputs/quality-architecture-path/multimodal-repro.pptx`.
- `node src/qa.mjs outputs/quality-architecture-path/multimodal-repro.pptx` — 10 text-editable slides and one native chart. Architecture slide S04 has 15 editable text objects, 29 native shapes, and zero detected text overlaps.
- `node scripts/preview.mjs outputs/quality-architecture-path/multimodal-repro.pptx` — rendered 10 pages using PowerPoint 16.0 and Poppler 26.07.0. Page 4 was opened and visually inspected; node and relation labels are readable, with no text overlap.
- Synthetic PPTX SHA-256: `2087DBDE681DBABAB350717C3EFB21473652CAF7818FBBC1746E85DDF174A64C`.

## Limits

Graph and action-label checks establish only structural plausibility. They cannot determine whether the architecture matches a real implementation, whether the arrow directions are factually right, or whether the chosen decomposition explains the audience's question. The layout routine avoids text-box collisions but does not judge visual taste or prove that a diagram is semantically complete. Formal quality review and human `diagram_logic` review remain required.
