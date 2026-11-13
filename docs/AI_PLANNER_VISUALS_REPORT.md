# AI planner visual materialization evidence

Date: 2026-11-13

Scope: Offline, synthetic fixture proving that structured AI storyboard process and architecture requests are rendered into native editable PowerPoint objects.

## Reproduce

```powershell
node scripts/render-ai-planner-visual-fixture.mjs
node src/qa.mjs outputs/planner-visual-demo/synthetic-planner-demo.pptx
node scripts/preview.mjs outputs/planner-visual-demo/synthetic-planner-demo.pptx
```

The fixture makes no API request and contains no research data. It produces a six-slide draft with a three-step process on slide 2 and a five-node, four-edge architecture on slide 4. The planner materializes 2 of 4 explanatory slides (50%) with editable shapes. Preview images and PPTX are generated under ignored `outputs/` and are not repository inputs.

## Verified evidence

- The planner API contract test runs against a loopback stub, writes an editable draft, and confirms it remains pending human review.
- The planner visual test inspects PPTX OOXML and confirms the process steps, architecture nodes, relationship labels, and native shape objects are present.
- For both visual slides, `auditTextLayout` reports all text inside slide bounds, zero text-to-text overlaps, and no non-footer text below 12 pt.
- A PowerPoint 16.0 render produced all six PNG pages. Every page was visually inspected; slides 2 and 4 contain the generated visuals.
- The six-slide structural QA reports zero overlap pairs, zero small-text objects, and in-bounds text on all pages. QA still warns that this standalone synthetic deck lacks a build review/source-completeness report; that warning is expected and is not treated as a pass on scientific or editorial quality.

## Limits and next work

This proves one synthetic request path for editable process and architecture visuals. It does not prove generated diagrams are semantically correct, aesthetically strong for every topic, or factually supported; source-ID membership is traceability, not claim entailment. The planner deliberately fails closed for image, table, and data-figure requests it cannot materialize. Cover/closing art, section/agenda generation, full-deck composition, Chinese editorial quality, scientific verification, and representative real-user quality remain unproven and require separate implementation and human review.
