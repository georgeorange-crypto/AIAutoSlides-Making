# Milestone 1 implementation and verification

**Date:** 2026-11-12
**Checkout:** Windows, branch `dev`; this milestone is pushed after user authorization.
**Runtime:** Node.js 24.14.0, PptxGenJS 4.0.1, fflate 0.8.3.

## Delivered

- Preserved the original seven-slide research demo and made factual claims retain evidence IDs and verification state in a SHA-256 lineage manifest.
- Added deterministic CSV and controlled Markdown imports. CSV inputs produce editable PowerPoint chart objects; bar and line modes are explicit. Line charts accept signed finite values; bars retain nonnegative/zero-baseline constraints.
- Added storyboard/schema checks, long-copy warnings, dependency diagnostics, theme contrast enforcement (4.5:1), and OOXML QA for 16:9 ratio, editable text, shape bounds, evidence mapping, native chart caches, and embedded chart workbook values.
- Added offline examples, three-theme support, a product benchmark protocol, CI checks/artifacts, Windows PowerShell-first usage and preview documentation, and a source-to-implementation research matrix.
- No paid API, private research upload, proprietary template, or third-party visual asset was used. The lockfile resolves packages from the public npm registry.

## Commands and results

| Command | Result |
|---|---|
| `npm ci --registry=https://registry.npmjs.org --no-audit --no-fund` | Passed; dependency lockfile installed cleanly. |
| `npm run check` | Passed: 13 tests; research, CSV, Markdown, and line workflows validated/built; QA completed for all three PPTX examples. |
| `npm run preview` | PowerPoint export to PDF and Poppler PDF-to-PNG completed for the 7-page research deck and both 8-page synthetic decks. |
| `git diff --check` | Passed; only Git line-ending conversion notices were emitted. |

Rendered pages were manually inspected at 1600×900: 7 research-demo pages, 8 synthetic CSV pages, and 8 synthetic line-chart pages. An initial visual review identified low-contrast dark chart axis labels; theme-aware axis colors were applied and the resulting previews inspected.

## Output and QA

- `outputs/research-demo.pptx`, `.pdf`, seven page PNGs, evidence manifest, and `.qa.json`/`.qa.md`.
- `outputs/synthetic-csv-demo.pptx`, `.pdf`, eight page PNGs, evidence manifest, and QA reports.
- `outputs/synthetic-line-demo.pptx`, `.pdf`, eight page PNGs, evidence manifest, and QA reports.
- `outputs/research-demo-contact-sheet.png` and `outputs/synthetic-csv-demo-contact-sheet.png` are generated overviews. Individual line-chart pages were inspected; a contact sheet is not required for that review.

All three PPTX QA reports contain zero structural errors. Chart values match exactly across the input storyboard, native chart cache, and embedded XLSX workbook. Contrast checks report no token pairs below 4.5:1. QA status remains `warning` where evidence is intentionally unverified: research demo IDs E1/E2 and missing chart sample size; synthetic examples are expressly teaching data, not empirical evidence. Automated XML checks cannot establish all pixel-level fit, font substitution, or scientific validity.

## Milestone status and next work

Milestone 1 is implemented and locally verified. Milestone 2 has started with the native line-chart tranche; multi-series, scatter/CDF, uncertainty and run-level provenance remain future work. Milestones 3–4 are not complete: the next useful increment is audience/style preview comparison with a blinded, reproducible human-rating protocol, followed by adapters only where the benchmark demonstrates a need. No comparative product scores are claimed.
