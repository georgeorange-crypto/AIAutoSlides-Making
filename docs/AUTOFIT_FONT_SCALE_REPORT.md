# Persisted PowerPoint auto-fit font scale gate

## Defect reproduced

The structural audit previously read explicit run sizes such as `sz="5200"` as 52 pt but ignored a persisted DrawingML `<a:normAutofit fontScale="20000"/>`. PowerPoint therefore displayed a title at 10.4 pt while the formal 14 pt check saw only the authored 52 pt size.

## Change

`src/layout-audit.mjs` now applies a valid persisted `fontScale` (range 0–100000) to every explicit text-run size inside that shape. The existing `smallText` report and formal `QUALITY_TEXT_TOO_SMALL` gate consume the effective size. Invalid scale values fail closed as zero. An auto-fit element without a persisted scale continues to use its authored run sizes; renderer-specific or device-specific scaling that is not serialized remains outside this OOXML calculation.

## Verification evidence

- `node --test tests/layout-audit.test.mjs tests/quality-audit.test.mjs`: 52 tests passed after adding 40% scale parsing and a formal-gate regression for a 52 pt title persisted at 20% scale.
- Synthetic regression XML: a 14 pt run with `fontScale="20000"` is measured as 2.8 pt and appears in `smallText`.
- Real deck stress: copied `outputs/research-demo.pptx` to `outputs/research-demo-autofit-stress.pptx`, changed only the first title's `normAutofit` to `fontScale="20000"`, then ran `node src/qa.mjs outputs/research-demo-autofit-stress.pptx`. QA recorded the 52 pt title at 10.4 pt and warned that the page contains text below 14 pt. The original deck QA remains unaffected.
- Rendered the stress copy with PowerPoint 16.0 and Poppler `pdftoppm 26.07.0`; `outputs/research-demo-autofit-stress-page-1.png` visibly shows the title reduced to very small text. The generated PPTX, PDF, and PNG remain in ignored `outputs/` and are not committed.

## Limits

This detects effective font scales recorded in the PPTX package. A renderer may make an unrecorded fit/substitution decision, so it does not prove every viewer will use the same glyph size. The formal path still requires rendered-page inspection, and typography also depends on font availability, script shaping, contrast, and viewing distance.
