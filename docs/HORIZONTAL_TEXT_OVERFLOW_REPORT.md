# Horizontal rendered text overflow: verification record

## Change

The local OCR screen previously counted authored words only when they appeared below the matched body-text geometry. It now associates recognized words with text-box copy, checks the matching box on all four edges, applies a 1.5% page-size tolerance to OCR geometry, and reports edge counts in the formal finding. OCR words that fall inside another text box containing the same token are not counted as overflow.

## Adversarial evidence

- `node --test tests/rendered-critic.test.mjs tests/quality-audit.test.mjs` — 43 passed, 0 failed. Includes horizontal overflow, vertical overflow, CJK single-character OCR tokens, unrelated footer text, and boundary jitter cases.
- `node scripts/render-section-structure-fixture.mjs --horizontal-text-overflow-stress` — generated a seven-page synthetic PPTX and rendered through PowerPoint 16.0 / Poppler 26.07.0. The adapter narrowed the S04 body box and disabled wrapping/autofit; the image visibly shows text extending past the box to the right. The actual OCR screen found 11 matched authored words past the right edge, and the Harness formal gate returned `QUALITY_RENDERED_TEXT_OVERFLOW` for S04. It also returned independent expected findings for repeated text, English-dominant copy, insufficient distinct explanation, and low density. The S04 stress PPTX SHA-256 is `f35e1bcd11af1a55063fab5348da7989c7252efe811d56df26f2bcdeea3b785c`.
- The image `outputs/quality-section-structure/run-2026-11-14T01-02-46-437Z/runs/synthetic-sections/presentation-page-4.png` was opened and inspected; its line is visibly clipped at the slide edge after leaving its shortened text box.

## Limits

This is a geometry-and-OCR screen, not a universal glyph collision detector. OCR mistakes, text clipped beyond the slide canvas, or spill that cannot be linked to a particular authored text box can escape it. Text-box overlap detection remains a separate structural check; human page-by-page visual review is still required.

## Rendered title overflow follow-on — 2026-11-13

- The rendered Critic now matches OCR words to the authored title box and measures word-box edges on all four sides with the same 1.5% page-size tolerance. Exact Latin tokens are required; for Chinese titles, OCR sub-tokens are allowed. Words that belong to another authored text box are excluded to avoid counting repeated labels such as “Synthetic” in a chart axis as title spill.
- Formal quality audit checks every rendered page. Positive title overflow (`QUALITY_TITLE_TEXT_OVERFLOW`) and missing title geometry/OCR evidence (`QUALITY_TITLE_OVERFLOW_UNMEASURED`) both block approval.
- `node scripts/create-title-overflow-stress.mjs` creates a separate synthetic PPTX, replaces the S04 title with a long fixture headline, and disables wrapping for that title only. PowerPoint 16.0 / Poppler 26.07.0 rendered the stress PPTX; page 4 visibly runs past the right edge of the authored title box and is clipped at the slide edge. OCR found one matched title word box outside the right boundary. The seven-page baseline demo had zero title overflow words on every page, including repeated words shared with body/chart labels.
- Stress PPTX SHA-256: `61ac00c6a8767d008d6430be2497034303162417f4dc339ab187b73c2ba3cc71`.
- Targeted tests: `node --test tests/rendered-critic.test.mjs tests/quality-audit.test.mjs` — 50 passed, 0 failed. Fixtures cover a positive right-edge spill and missing title geometry; the rendered demo is a real-world negative control.
- Generated stress PPTX, page images and QA manifests are under ignored `outputs/` and are not committed. Reproduce with the command above, then run `node src/qa.mjs outputs/title-overflow-stress.pptx` and `node scripts/preview.mjs outputs/title-overflow-stress.pptx`.

The title check is still OCR-based: recognition errors, unusual scripts, or words cut off so severely that OCR cannot identify them can escape the positive detector. Missing title measurements fail closed, but a zero count is not a claim of aesthetic approval; inspect every rendered page.
