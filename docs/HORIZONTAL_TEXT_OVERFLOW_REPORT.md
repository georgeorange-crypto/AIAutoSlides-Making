# Horizontal rendered text overflow: verification record

## Change

The local OCR screen previously counted authored words only when they appeared below the matched body-text geometry. It now associates recognized words with text-box copy, checks the matching box on all four edges, applies a 1.5% page-size tolerance to OCR geometry, and reports edge counts in the formal finding. OCR words that fall inside another text box containing the same token are not counted as overflow.

## Adversarial evidence

- `node --test tests/rendered-critic.test.mjs tests/quality-audit.test.mjs` — 43 passed, 0 failed. Includes horizontal overflow, vertical overflow, CJK single-character OCR tokens, unrelated footer text, and boundary jitter cases.
- `node scripts/render-section-structure-fixture.mjs --horizontal-text-overflow-stress` — generated a seven-page synthetic PPTX and rendered through PowerPoint 16.0 / Poppler 26.07.0. The adapter narrowed the S04 body box and disabled wrapping/autofit; the image visibly shows text extending past the box to the right. The actual OCR screen found 11 matched authored words past the right edge, and the Harness formal gate returned `QUALITY_RENDERED_TEXT_OVERFLOW` for S04. It also returned independent expected findings for repeated text, English-dominant copy, insufficient distinct explanation, and low density. The S04 stress PPTX SHA-256 is `f35e1bcd11af1a55063fab5348da7989c7252efe811d56df26f2bcdeea3b785c`.
- The image `outputs/quality-section-structure/run-2026-11-14T01-02-46-437Z/runs/synthetic-sections/presentation-page-4.png` was opened and inspected; its line is visibly clipped at the slide edge after leaving its shortened text box.

## Limits

This is a geometry-and-OCR screen, not a universal glyph collision detector. OCR mistakes, text clipped beyond the slide canvas, or spill that cannot be linked to a particular authored text box can escape it. Text-box overlap detection remains a separate structural check; human page-by-page visual review is still required.
