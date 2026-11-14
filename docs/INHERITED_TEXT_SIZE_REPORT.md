# Inherited text-size gate

## Defect reproduced

The PPTX audit accepted a text shape or native table when it found at least one explicit font size. Other visible runs could inherit an unmeasured size and bypass the 14 pt formal gate. Native table cells were only scanned for explicit small sizes; absent sizes were not reported as unmeasured.

## Change

The audit now measures each visible DrawingML text run using its own `a:rPr` size or its paragraph's `a:defRPr` size. Any run with neither is reported as unmeasured, including when neighboring runs have explicit sizes. Native PowerPoint table cells use the same per-run check; table fonts are included in the slide font inventory. The quality blocker reports the table element and count of unmeasured runs. Existing chart-frame scanning remains separate from chart-part style inspection.

## Verification evidence

- `node --test tests/layout-audit.test.mjs tests/quality-audit.test.mjs tests/table-slide.test.mjs`: 57 tests passed. Regression cases cover a measured text run next to an inherited-size run, a native table with one inherited cell, an explicit 8 pt table run, and the formal blocker for unmeasured table text.
- The table integration test builds a real editable PPTX, removes `sz` from one existing cell run, runs `src/qa.mjs`, and finds that table run in `unmeasuredText`. It then changes a table run to 8 pt and finds it in `smallText`.
- A PowerPoint 16.0 render of the synthetic stress copy (`outputs/table-small-cell-stress-page-2.png`) visibly shows its first table header smaller than adjacent headers. QA reports the table's measured minimum as 8 pt. The unmodified synthetic table QA has no table small-text or unmeasured-size findings.
- The stress PPTX, preview PDF, PNGs, and mutation helper remain under ignored `outputs/`; no generated files are committed.

## Limits

The check covers sizes encoded on text runs and paragraph defaults in the slide package. It does not resolve every style inherited through arbitrary PowerPoint masters or certify glyph size after font substitution on another system. Rendered inspection remains required.
