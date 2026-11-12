# Research demo cover-column correction

Status: **implemented and regression-tested**.

The cover title, kicker, body lines, and subtitle now stay within the left content column instead of crossing the right decorative panel. Text remains native editable PowerPoint text, and `fit: shrink` handles long strings within their bounded boxes.

## Verification

- `node --test tests/assets.test.mjs`: **7/7 passed**, including PPTX XML geometry check for a long editable cover title.
- Full `npm run check` and refreshed rendered preview results are recorded after execution.
- Prior visual review found the demo's cover title visibly intruding into the right panel; this change specifically addresses that issue. Final rendered review is pending.

## Full verification and rendered review

- Full `npm run check`: exit code 0; **153/153 tests passed**, then all synthetic data imports, validation, presentation builds, and QA stages completed. Only expected warnings for unverified example evidence and sample-size annotation remain.
- `npm run preview`: PowerPoint 16.0 + Poppler 26.07 produced a 7-page PDF and PNGs; `node src/qa.mjs outputs/research-demo.pptx` found 7 text-editable slides and one native chart with review warnings.
- All seven pages were opened. The cover title now wraps on the left and clears the decorative panel; pages 2–7 show no apparent clipping. The deck remains unverified example content and has not received human design approval.
