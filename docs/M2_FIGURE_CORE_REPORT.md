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

- Added a local experiment run-audit CLI. It requires stable `run_id`, ISO `run_timestamp`, and per-run `observation_id`, hashes exact source bytes and normalized source rows, and compares saved manifests with explicit added/changed/removed observations. Unit tests cover identity, hashes, all three diff classes, duplicate IDs, inconsistent timestamps and missing required columns. A local end-to-end run reported exactly 1 added, 1 changed and 1 removed row. This is an integrity/change report; it does not prove authenticity, validate units, or establish scientific correctness.
- Do not produce confidence intervals or error bars until an input contract and real repeated-run evidence support them. The current synthetic fixtures do not qualify.
- Real-experiment data refresh/diff and first-run/second-run production-time reporting are not implemented; no timings or manual-repair totals are claimed.
- Shared-evidence `talk` / `reading` deck outputs remain future work.
- PDF/DOCX offline source adapters remain optional and unimplemented.

M2 remains open. Next priority: validated experiment measurement schemas and statistically sound repeated-run summaries from authorized real input, followed by deterministic deck update/diff measurement. No experiment data was supplied for this tranche, and none was uploaded.

## Local run-audit tranche verification (2026-11-12)

| Command | Result |
|---|---|
| `npm test` | Passed; 20 tests. |
| `npm run check` | Passed; dependencies, tests, imports, validation, deck builds and structural QA for all supported chart examples. Expected warnings remain for synthetic or unverified evidence and missing demo sample size. |
| `node src/run-audit.mjs <csv> <manifest.json>` | Passed on a temporary local fixture; wrote JSON and Markdown. |
| `node src/run-audit.mjs <csv> <next.json> <baseline.json>` | Passed; identified one added, one changed and one removed observation. |
| `npm run preview` | Attempted but PowerPoint COM did not return in the available window; no claim of a fresh render is made. This tranche did not change slide rendering. Existing figure preview review above belongs to the prior figure tranche. |
| `git diff --check` | Passed; Git reported line-ending normalization notices only. |
