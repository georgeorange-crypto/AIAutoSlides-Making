# Main-title hierarchy gate

## Defect reproduced

The formal readability gate previously blocked authored text below 14 pt but did not distinguish a slide's main title from body copy. A generated 25 pt title could pass despite losing the large, readable hierarchy expected for presentation headings.

## Change

PPTX QA now records the minimum effective font size for each text box after applying persisted `normAutofit fontScale`. The formal quality gate normalizes whitespace in the authored slide title, matches it to an emitted PPTX text box, and requires at least 28 pt. Missing matches and sizes fail closed. The existing 14 pt floor remains in force for other authored text.

## Verification evidence

- The unit boundary check rejects 27.9 pt, accepts 28 pt, and blocks a missing size or an unmatched title.
- An end-to-end Harness regression uses the real PptxGenJS IR adapter. Its long title is emitted at 25 pt and the formal gate fails that page; the same workflow confirms a 30 pt title passes this rule.
- `src/layout-audit.mjs` tests confirm text-box QA exposes the measured effective size used by the title gate.
- The standard synthetic example's seven titles measure 34–52 pt, so the new floor does not affect those slides.

## Limits

The floor is a legibility and hierarchy constraint, not an aesthetic score. A 28 pt title can still be awkward, generic, or poorly balanced with the page. PowerPoint may make device-specific font substitutions, and unpersisted rendering adjustments may differ from package measurements; render inspection and human review remain necessary.
