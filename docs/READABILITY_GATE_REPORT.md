# Readability gate and footer cleanup

Date: 2026-11-13

## Scope

This phase hardens the formal rendered-PPTX path against defect 3 (small or overlapping text) and reduces one repeated source of defect 10 (tiny, defensive footer copy). The hard lower bound is 12 pt; this is a measurable floor, not a claim that 12 pt is ideal for every room or viewing distance.

## Changes

- `auditTextLayout` now checks small text at every vertical position. Being near the bottom edge no longer exempts text from the 12 pt floor.
- Text shapes with no explicit measurable run size are reported as `unmeasuredText`; the formal quality audit blocks these rather than assuming inherited typography is readable. Chart frames with no slide-level text sizing remain outside this explicit-run check.
- The formal quality gate emits `QUALITY_TEXT_TOO_SMALL` for text below 12 pt and `QUALITY_TEXT_SIZE_UNMEASURED` for unmeasured text, with text and object position attached for repair.
- The legacy PPTX renderer removes the repeated tiny evidence label and draft badge from every slide. Full evidence ID, source, locator, verification status and note are preserved in that slide's speaker notes. The only page-footer text is now the page number at 12 pt.
- Renderer defaults that had authored 9.5–11.5 pt text were raised; dense tables have a 12 pt floor. The renderer's `fit: shrink` behavior can still reduce the effective OOXML size, so the built PPTX QA remains authoritative.
- The Canva state-mismatch test now disables automatic redirect following. It previously followed the deliberate authorization redirect to Canva, causing an unnecessary network request during tests.

## Adversarial regression evidence

- `tests/layout-audit.test.mjs`: a 7 pt text shape at y=95% is still reported; a bottom-positioned text shape without explicit size is reported as unmeasured.
- `tests/quality-audit.test.mjs`: the formal gate blocks bottom-positioned 11 pt text and unknown-size text.
- `tests/ai-plan-contract.test.mjs`: generated process/architecture PPTX text has no measured text below 12 pt; source IDs and `unverified` state remain in slide notes.
- `tests/canva-oauth.test.mjs`: the state-mismatch failure path is tested with a manual redirect and no external request.
- Targeted suite: 22/22 passed. Full suite after renderer/footer changes: 281 passed, 0 failed, 11 optional-tool skips.

## Rendered evidence

Synthetic `examples/research-demo.json` was built to `outputs/readability-gate/research-demo.pptx` and rendered with PowerPoint 16.0 + Poppler `pdftoppm` 26.07.0. All 7 PNG pages were opened and reviewed after the final font-size edits. Structural QA reports 7/7 editable-text slides, 0 text-overlap pairs, 0 authored text runs below 12 pt, and 0 text runs with unmeasurable explicit size. PPTX SHA-256: `4061103bdbede6c8d9e84f852352e4679993582085abb68b69f444ad90cdd3cb`.

The preview exists and has been visually inspected, but no human approval record was created; QA status remains `warning` and human review remains `pending`. Existing synthetic-data warnings about unverified evidence and missing chart sample size remain.

## Rendered density gate (2026-11-13)

This follow-up addresses defect 2 for formal content pages. Text-unit counts alone allowed a long single sentence to pass even when most of the page was empty. Local Tesseract now returns OCR word boxes and image dimensions; PPTX QA supplies each authored text shape's text and slide geometry. The critic measures the union of OCR word-box pixels inside text boxes mapped to visible slide-body fields, excluding titles and unrelated labels. Missing OCR geometry or a missing body-text mapping is an explicit blocking `QUALITY_VISIBLE_DENSITY_UNMEASURED` result.

Content pages without a planned structured visual must have at least 4.5% visible body-text coverage of the content region and at least two OCR body-text lines. Pages with structured visuals use a 1.2% visible body-text floor, while existing plan checks still require sufficient explanatory text and visual coverage. Cover, agenda, section-transition, and closing roles are excluded from content density thresholds. These deterministic floors catch sparse layouts; they do not judge whether the text is useful or a diagram is meaningful.

Adversarial evidence: an existing seven-page synthetic PPTX was modified so S02 contained a single Chinese sentence long enough to satisfy the prior text-unit threshold. Local OCR measured its body-text box union at 3.46%, below the 4.5% no-visual floor; this is now a blocking density result. A regression test also proves that a text-unit-compliant page with OCR coverage of 3.4% is blocked, while absent density measurements fail closed. OCR line detection is noisy and remains a screening signal, not an aesthetic judgment.

Verification for this phase: full `npm test` completed with 283 passed, 0 failed, 11 optional skips; focused layout/OCR/quality/document-import tests completed with 32 passed, 0 failed. `npm run validate` passed with the existing 3 synthetic-data warnings. A seven-slide synthetic deck was built to `outputs/visible-density-phase/research-demo.pptx`, passed structural QA with 7 editable-text slides and 1 native chart, and rendered with PowerPoint 16.0 + Poppler 26.07.0. All seven final PNGs were opened and inspected. No human approval record was created; QA remains warning/pending. The original `outputs/research-demo.pptx` was not overwritten. Generated PPTX/PDF/PNGs and the adversarial fixture remain untracked/ignored and are not part of this change.

## Limits

The 12 pt floor does not guarantee comfortable projection readability; some slides need larger text based on audience, room and content. OOXML run sizes do not detect font substitution, rasterized text inside images, or all chart-internal style inheritance. Geometry overlap is a bounding-box screen and may flag intentional intersections or miss visual collisions caused by rendered glyphs. Page-by-page visual review remains mandatory. This phase does not solve the other presentation defects or certify narrative quality, aesthetic quality, source correctness or scientific truth.
