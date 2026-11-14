# Native chart typography gate

Date: 2026-11-13

## Defect and fix

The synthetic demo was rendered with the `academic-light` theme, which declares Aptos Display/Aptos. Its editable slide text rendered with those fonts, but chart data labels were emitted in `ppt/charts/chart1.xml` as Arial at 12 pt. The slide's `graphicFrame` contains no chart text styles, so the existing slide-XML font and size audit missed this. In the rendered PDF, page 4 used ArialMT for chart labels while the rest of the page used Aptos.

Chart data labels now explicitly use the theme body font at 14 pt. Chart legends explicitly use the same family and size. Structural QA follows each slide's chart relationships, inspects each linked chart part's `c:txPr`, and merges the measured font faces, small-text findings, and unmeasured font/size findings into that page's QA record. The existing formal quality gate then blocks chart text below 14 pt, outside the selected heading/body font pair, or missing measurable font/size metadata.

## Adversarial coverage

- Unit fixtures verify chart XML contributes font names and point sizes and that inherited font/size declarations are classified as unmeasured.
- A generated real PPTX fixture verifies the normal chart uses the selected theme's font at 14 pt. The test then mutates the chart XML back to Arial/12 pt and confirms page QA detects both conditions.
- Formal quality-audit tests verify that the measured Arial mismatch and 12 pt label block the deck.

## Rendered evidence

- Synthetic seven-page deck, `academic-light`, rendered by PowerPoint 16.0 and `pdftoppm` 26.07.0.
- Before the change, `pdffonts -f 4 -l 4` reported `ArialMT` along with Aptos/Aptos Display. After the change, page 4 reports only Aptos/Aptos Display; its labels are visibly larger and remain legible in the rendered chart.
- All seven pages were rendered; the affected chart page was inspected at full 1600 × 900 resolution.

## Limits

This gate detects font and size declarations in native chart XML; it does not assess chart-label placement, overlap inside every chart shape, typeface aesthetics, or substitution on a different recipient's system. A local rendered-PDF check is still needed to detect renderer-specific substitutions, and human review remains necessary for the overall deck.
