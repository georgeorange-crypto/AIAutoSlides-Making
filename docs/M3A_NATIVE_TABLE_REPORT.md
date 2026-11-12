# Milestone 3A follow-on — native editable table slide

Date: 2026-11-12 · Scope: one deterministic table-slide vertical slice.

## Delivered

- `type: "table"` accepts 2–6 headers and 1–10 rows. Rows must match the column count; cells are bounded strings or finite numbers. Table slides require evidence IDs.
- The renderer creates a native PowerPoint table object with editable cells, styled header, alternating body rows, right-aligned numeric values, and an optional caption.
- The evidence manifest records table headers, exact row values, caption, editability level, cited source IDs, source locators, and source hashes.
- QA counts native table objects and checks their slide placement and cell text against the storyboard. The synthetic fixture lives in `examples/table-demo/`.
- `npm test` now invokes only root project tests through `scripts/run-tests.mjs`; this prevents unrelated tests inside generated `outputs/` checkouts from contaminating CI.

## Verification

| Check | Result |
|---|---|
| `npm test` | Passed: 85 tests, 0 failures. |
| `npm run check` | Passed after isolating the project test directory; critic evaluation, import/validation/build/QA fixtures, repeated-run and dual-edition checks completed. |
| Table example | Validated and built: 2 slides, 1 native table, exact headers/cells, one cited unverified synthetic CSV source with row locator and SHA-256. |
| QA | Warning only for intentionally unverified synthetic evidence; `nativeTableCount=1`, `tableDataExactMatch=true`, no structural errors. |
| Preview | PowerPoint 16.0 exported PDF; Poppler 26.07 rendered both PNG pages. Both were inspected; no table overflow or illegible cells observed. |

## Limits and next phase

This layout does not support merged cells, multi-page table continuation, automatic extraction from arbitrary source tables, or code blocks. The next bounded content-layout phase is an editable code-snippet slide with syntax-aware wrapping and a source/filename field. Neither table cells nor their values imply scientific verification; the fixture remains explicitly synthetic.
