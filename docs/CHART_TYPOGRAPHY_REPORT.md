# Native chart typography gate

Date: 2026-11-13

## Defect and fix

The synthetic demo was rendered with the `academic-light` theme, which declares Aptos Display/Aptos. Its editable slide text rendered with those fonts, but chart data labels were emitted in `ppt/charts/chart1.xml` as Arial at 12 pt. The slide's `graphicFrame` contains no chart text styles, so the existing slide-XML font and size audit missed this. In the rendered PDF, page 4 used ArialMT for chart labels while the rest of the page used Aptos.

Chart data labels now explicitly use the theme body font at 14 pt. Chart legends explicitly use the same family and size. Structural QA follows each slide's chart relationships, inspects each linked chart part's `c:txPr`, and merges the measured font faces, small-text findings, and unmeasured font/size findings into that page's QA record. The existing formal quality gate then blocks chart text below 14 pt, outside the selected heading/body font pair, or missing measurable font/size metadata.

## Adversarial coverage

- Unit fixtures verify chart XML contributes font names and point sizes and that inherited font/size declarations are classified as unmeasured.
- A generated real PPTX fixture verifies the normal chart uses the selected theme's font at 14 pt. The test then mutates the chart XML back to Arial/12 pt and confirms page QA detects both conditions.
- The same real-PPTX fixture removes every chart text-style node, then breaks the slide-to-chart relationship; both mutations now produce unmeasured font and size findings, and unit tests verify the formal quality audit blocks unmeasured chart typography.
- Formal quality-audit tests verify that the measured Arial mismatch and 12 pt label block the deck.

## Rendered evidence

- Synthetic seven-page deck, `academic-light`, rendered by PowerPoint 16.0 and `pdftoppm` 26.07.0.
- Before the change, `pdffonts -f 4 -l 4` reported `ArialMT` along with Aptos/Aptos Display. After the change, page 4 reports only Aptos/Aptos Display; its labels are visibly larger and remain legible in the rendered chart.
- All seven pages were rendered; the affected chart page was inspected at full 1600 × 900 resolution.

## Fail-closed follow-on verification

- `node --test tests/layout-audit.test.mjs tests/quality-audit.test.mjs tests/chart-typography.test.mjs`: 46 passed, 0 failed.
- The real-PPTX fixture removes every `c:txPr` node and then, in a separate mutation, changes the slide relationship to a missing chart part. QA records both font and size as unmeasured in each case; formal quality-audit tests confirm those findings block approval.
- Full `npm test`: 357 total, 346 passed, 0 failed, 11 optional skips. `npm run validate`, `npm run build`, `npm run qa`, and `npm run preview` passed. Validation retained the existing chart sample-size and unverified-evidence warnings.
- PowerPoint 16.0 / Poppler 26.07.0 rendered all seven pages and each was opened. The chart page remains legible. The synthetic demo's overall whitespace and repeated visual style are not certified by this chart-focused change; automated checks and this local render do not replace a human design review.

## Rendered chart-label collision gate

- Structural QA now records the native chart frame bounds from the slide OOXML. The rendered Critic maps those bounds to the page image, then checks OCR word boxes whose centers fall inside the chart frame.
- Exact duplicate OCR boxes are deduplicated. Words below 35% OCR confidence are ignored. At least two usable chart-region words are required; otherwise the measurement is `null`. A chart with missing/unreadable geometry or a missing page image is also unmeasured. The formal Harness gate blocks both a positive overlap count and an unmeasured count (`QUALITY_CHART_TEXT_OVERLAP` / `QUALITY_CHART_TEXT_OVERLAP_UNMEASURED`).
- A pair is reported when its OCR boxes intersect by at least 35% of the smaller word box and the intersection is at least 2 px in both directions. This catches clear rendered text collisions; it is not a semantic label-placement score and may miss very small or OCR-misrecognized text. Chart font-size QA remains a separate OOXML gate.
- Tests inject colliding OCR boxes inside chart bounds and verify both positive and unmeasured results block formal quality approval. A reproducible synthetic-only stress tool, `scripts/create-chart-collision-stress.mjs`, creates a separate PPTX with chart text changed from 14 pt to 72 pt; it never overwrites its input.
- Rendered adversarial evidence: the six-long-category sample at `outputs/chart-crowding-stress-long-page-4.png` had 39 OCR words in the chart frame and 0 intersecting pairs; visual inspection showed tightly wrapped but non-overlapping labels. The 72 pt sample rendered visibly broken/clipped chart labels and yielded 0 usable chart-region OCR words (`chart_text_overlap_count: null`), so the formal gate blocks it as unmeasured rather than claiming successful collision detection. The default demo chart has a measurable zero-overlap result. These files are local generated evidence and must not be committed.
- This screen does not prove that category labels are adequately spaced, correctly associated with data, readable at every display size, or aesthetically composed. Human inspection of every rendered page remains required.

## Limits

This gate detects font and size declarations in native chart XML and fails closed when chart style metadata or its slide relationship is missing. Rendered OCR adds a bounded text-collision screen, but OCR or threshold limits can still miss collisions; a local render and human review remain necessary for label spacing, typography aesthetics, renderer substitution, and overall deck quality.
