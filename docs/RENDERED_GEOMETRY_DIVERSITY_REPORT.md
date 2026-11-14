# Rendered geometry diversity gate

## Defect reproduced

The existing diversity signature includes slide type and structured element kinds. A repeated page template could therefore appear diverse if a plan relabeled its pages or changed element-kind metadata while keeping the same rendered object placement.

## Change

The formal full-deck quality gate now computes a second signature directly from measured PPTX QA object bounds, independent of IR type and kind labels. It blocks when one quantized body-object arrangement covers at least 60% of all content pages and at least three pages have measurable body geometry. Pages with fewer than three measurable body objects do not contribute to this secondary check. Unmeasured pages remain in the full-deck denominator, so incomplete measurement cannot inflate the repeated-layout share.

## Regression evidence

- `node --test --test-name-pattern="rendered geometry diversity" tests/quality-audit.test.mjs`: passes. The adversarial case generates a real five-page synthetic PPTX with the same repeated template, runs `src/qa.mjs`, and feeds the measured bounds into the formal audit while labeling the IR pages as five different types. The gate reports five semantic signatures but a 100% repeated rendered-geometry share and blocks.
- The same regression perturbs object positions and sizes for its control; it passes the geometry-diversity check.
- A separate five-page stress deck was rendered with PowerPoint 16.0 and Poppler `pdftoppm` 26.07.0. All five PNG pages were opened; the repeated panels and body block visibly occupy the same positions on every page, while only the synthetic title and wording change. Ignored artifacts are under `outputs/repeated-template-visual-stress*`.
- Generated PPTX bytes are temporary test data and are removed after the test. No research data or generated deck is committed.

## Limits

Geometry similarity is a proxy for repeated layout, not an aesthetic score. It can flag a consistent grid that is intentionally useful, and quantization can miss near-identical arrangements around bucket boundaries. The 60% threshold and minimum-three-page condition do not prove that remaining pages are varied, beautiful, or logically matched to the story. Rendered page-by-page review remains necessary.
