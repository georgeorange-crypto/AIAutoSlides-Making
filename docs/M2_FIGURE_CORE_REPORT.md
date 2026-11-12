# M2 figure core implementation report

**Status:** M2 in progress; this report documents the figure-support tranche, not completion of the full milestone.
**Date:** 2026-11-12.
**Branch:** `dev`.

## Delivered

- Native bar/line charts accept up to six aligned named series over shared categories. Bar values remain nonnegative and zero-based.
- Native scatter charts preserve numeric x/y pairs and explicit units. The chart renderer follows PptxGenJS's separate shared-X and Y-series data convention.
- The CSV CDF workflow reads raw observations, groups tied values, and builds a right-continuous staircase. Every step is computed as cumulative count divided by raw `n`; the validator and PPTX QA independently recompute it from `raw_values` and compare the plotted x/y arrays.
- Figure lineage now retains source locators and raw/chart values, and records a chart-specific transform. Embedded-workbook auditing skips shared-string indices and checks numeric values column-by-column, preserving the chart series and row order despite Excel's row-major layout.
- Added synthetic examples and CI artifacts for multi-series, scatter, and CDF decks. No new dependencies were added.

## Verification

| Command | Result |
|---|---|
| `npm run check` | Passed; 17 tests, import/validation/build/QA for bar, line, multi-series line, scatter, CDF, Markdown and benchmark fixtures. |
| `node scripts/preview.mjs outputs/synthetic-multiseries-demo.pptx` | Passed; 8 PNG pages rendered. |
| `node scripts/preview.mjs outputs/synthetic-scatter-demo.pptx` | Passed; 8 PNG pages rendered. |
| `node scripts/preview.mjs outputs/synthetic-cdf-demo.pptx` | Passed; 8 PNG pages rendered. |

I inspected every page in the three new 8-slide previews and inspected each full-resolution chart slide. The review caught that straight-line interpolation was not a faithful ECDF; the final ECDF is a visible staircase with grouped ties. QA reports have zero structural errors and exact numeric agreement for chart caches/workbooks. Their warnings identify intentionally synthetic, unverified teaching evidence.

## Remaining M2 work

- Do not produce confidence intervals or error bars until an input contract and real repeated-run evidence support them. The current synthetic fixtures do not qualify.
- Real-experiment data refresh/diff and first-run/second-run production-time reporting are not implemented; no timings or manual-repair totals are claimed.
- Shared-evidence `talk` / `reading` deck outputs remain future work.
- PDF/DOCX offline source adapters remain optional and unimplemented.

M2 remains open. Next priority: a local-only experiment CSV contract with stable run IDs, source-row provenance and repeatable re-render/diff reporting, without requiring upload or external API use.
