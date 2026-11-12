# M2 figure core implementation report

**Status:** M2 implementation complete; local CI-equivalent and visual acceptance passed on synthetic fixtures. Real-study verification remains an input-specific human task.
**Date:** 2026-11-12.
**Branch:** `dev`.

## Delivered

- Native bar/line charts accept up to six aligned named series over shared categories. Bar values remain nonnegative and zero-based.
- Native scatter charts preserve numeric x/y pairs and explicit units. The chart renderer follows PptxGenJS's separate shared-X and Y-series data convention.
- The CSV CDF workflow reads raw observations, groups tied values, and builds a right-continuous staircase. Every step is computed as cumulative count divided by raw `n`; the validator and PPTX QA independently recompute it from `raw_values` and compare the plotted x/y arrays.
- Figure lineage now retains source locators and raw/chart values, and records a chart-specific transform. Embedded-workbook auditing skips shared-string indices and checks numeric values column-by-column, preserving the chart series and row order despite Excel's row-major layout.
- Added synthetic examples and CI artifacts for multi-series, scatter, and CDF decks. No new dependencies were added.
- Added a run-level summary importer for unpaired experiments. It calculates two-sided 95% Student-t confidence intervals for condition means from one pre-aggregated metric value per independent `run_id`; the expected independence and approximate normality assumptions and a 10-run minimum are explicit. Raw values, run/observation IDs and source row locators stay in figure lineage.
- Added editable PowerPoint custom error bars by narrowly patching the chart's DrawingML after PptxGenJS generation. The structural QA compares native error-bar values, cached means, and embedded workbook values to the source storyboard.

## Verification

| Command | Result |
|---|---|
| `npm run check` | Passed; 17 tests, import/validation/build/QA for bar, line, multi-series line, scatter, CDF, Markdown and benchmark fixtures. |
| `node scripts/preview.mjs outputs/synthetic-multiseries-demo.pptx` | Passed; 8 PNG pages rendered. |
| `node scripts/preview.mjs outputs/synthetic-scatter-demo.pptx` | Passed; 8 PNG pages rendered. |
| `node scripts/preview.mjs outputs/synthetic-cdf-demo.pptx` | Passed; 8 PNG pages rendered. |
| `npm test` | Passed; 23 tests, including Student-t critical values, interval tamper rejection, user-input verification state, and native custom error-bar XML. |
| Repeated-run import → validate → PPTX build → QA | Passed on the explicitly synthetic two-condition fixture; 8 slides, one native chart, one native error-bar series, chart workbook/means exact, error bars match input intervals. QA warns because the example is synthetic. |

I inspected every page in the three new 8-slide previews and inspected each full-resolution chart slide. The review caught that straight-line interpolation was not a faithful ECDF; the final ECDF is a visible staircase with grouped ties. QA reports have zero structural errors and exact numeric agreement for chart caches/workbooks. Their warnings identify intentionally synthetic, unverified teaching evidence.

## M2 scope and acceptance

- The local run audit hashes source bytes and normalized rows, retains run/observation identity, and reports added/changed/removed observations. Duplicate IDs, inconsistent timestamps, missing fields, comment preambles and BOM handling have regression coverage. These hashes establish integrity/change identity only; they do not establish source authenticity, valid units, or scientific correctness.
- `src/refresh-runs.mjs` now completes the local CSV → run diff → storyboard/evidence generation → validation → conditional PPTX rebuild → structural QA path. It records first-run and subsequent pipeline elapsed times, input and PPTX hashes, changed rows, build status, QA path, and optional operator-supplied human repair minutes. A third unchanged run skips PPTX rebuilding. No network or paid API is used.
- `src/build-dual.mjs` branches Talk and Reading decks from one validated storyboard/evidence graph. Talk preserves the authored sequence; Reading appends cited source records, chart methods, and deterministic figure data. Both output reports share a graph hash and citation IDs.
- Unit/integration coverage now has 26 passing tests. `npm run check` covers imports, validation, generated PPTX and chart QA, repeated-run uncertainty bars, refresh diff/rebuild/no-op behavior, and both presentation profiles. GitHub Actions uploads both profile PPTX files and their lineage/QA reports.
- Both Talk (7 slides) and Reading (11 slides) were exported with local PowerPoint to PDF/PNG. I opened and visually reviewed all 18 rendered pages; values, chart, source appendix and data appendix are visible and legible. Full-size render artifacts are under ignored `outputs/m2-dual/`.
- No real experiment CSV was supplied. Actual scientific provenance, design suitability, and source-to-study correctness therefore remain unverified; fixture timings are software-pipeline timings on synthetic teaching data, not research productivity evidence. Human repair duration is user-entered if measured, never inferred.
- Paired/crossover inference, protocol-drift analysis, unequal-variance comparisons, multiple-comparison correction, and within-run repeated observations are outside the current statistical contract. Optional offline PDF/DOCX parsing/OCR remains deferred; the milestone's local CSV path is complete.

## M2 completion verification (2026-11-12)

| Command / review | Result |
|---|---|
| `npm test` | Passed, 26/26 tests. |
| `npm run check` | Passed end-to-end: dependencies/license check, test suite, Markdown/CSV importers, validation, 7 chart/style deck builds, structural QA and dual-profile build. Expected warnings for synthetic and unverified evidence remain. |
| Refresh integration test | Passed first build, one changed observation and rebuild, operator-reported repair time, then unchanged source/no rebuild; QA errors empty, PPTX hash stable on no-op. |
| Dual deck generation and source graph | Passed; 7-slide Talk + 11-slide Reading, one shared graph hash and evidence IDs; QA reports have zero errors. |
| PDF/PNG rendering and manual review | Passed; Talk 7 pages and Reading 11 pages rendered locally and every page opened/reviewed. |
| Real-data review | Not performed: no real experimental run-summary CSV was supplied. |

**M2 is complete as a software capability and verified against explicitly synthetic inputs.** Do not interpret this as validation of any actual study. Next phase: M3 audience/storyboard intelligence and a rule-linked slide critic, while preserving a human review gate.

## Local run-audit tranche verification (2026-11-12)

| Command | Result |
|---|---|
| `npm test` | Passed; 23 tests. |
| `npm run check` | Passed after the Student-t implementation; 23 tests, all importer/validation/build/QA paths including repeated-run deck. |
| `node src/run-audit.mjs <csv> <manifest.json>` | Passed on a temporary local fixture; wrote JSON and Markdown. |
| `node src/run-audit.mjs <csv> <next.json> <baseline.json>` | Passed; identified one added, one changed and one removed observation. |
| `npm run preview` | Attempted but PowerPoint COM did not return in the available window; no claim of a fresh render is made. This tranche did not change slide rendering. Existing figure preview review above belongs to the prior figure tranche. |
| `git diff --check` | Passed; Git reported line-ending normalization notices only. |

## Student-t uncertainty tranche verification (2026-11-12)

| Command | Result |
|---|---|
| `npm test` | Passed; 23 tests. |
| `npm run from:repeated` + `node src/cli.mjs validate ...` | Passed; 20 synthetic run rows, two conditions, source SHA-256 retained. |
| `node src/cli.mjs build ... synthetic-repeated-demo.pptx` + `node src/qa.mjs ...` | Passed structural QA: 8/8 slides contain editable text, one native chart and workbook, exact means, one error-bar series, `errorBarsMatch=true`. QA status is `warning` for the intended synthetic source. |
| `node scripts/preview.mjs outputs/synthetic-repeated-demo.pptx` | Passed; 8 PNG pages rendered. All eight were inspected, including the full-resolution chart page: editable error bars are visible and the mean labels, units, run counts and assumptions fit. |
