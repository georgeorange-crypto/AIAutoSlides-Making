# M4 local update benchmark

**Run date:** 2026-11-12
**Task:** First build and controlled one-row update of the bundled synthetic repeated-run dataset
**Status:** Mechanical pipeline benchmark; not a competitor comparison or scientific result.

## Procedure

Run `npm run benchmark:update`. The runner refuses input unless the source contains an explicit `SYNTHETIC` label. It creates a local copy, builds the first 8-slide native PPTX, changes `baseline-01 / obs-b01` from 52 ms to 53 ms, and builds a second deck. It verifies the run diff, evidence IDs, embedded chart workbook, native error-bar data, and deck object counts. Original fixture files are not changed.

Reproduce from the repository root:

```powershell
npm run benchmark:update
Get-Content outputs/m4/update-benchmark.benchmark.md
```

## Observed result

| Measure | Result |
|---|---:|
| First-run pipeline | 1,485.76 ms |
| One-row update pipeline | 1,367.78 ms |
| Input observations / distinct runs | 20 / 20 |
| Row diff | 0 added, 1 changed, 0 removed |
| Changed observation | `baseline-01 / obs-b01`, 52 → 53 ms |
| Chart data values checked | 2 condition means; exact in storyboard, chart cache, and embedded workbook |
| Student-t error bars | Exact on first and updated PPTX |
| Editable text slides | 8 / 8 |
| Native charts / native error-bar series | 1 / 1 |
| Raster pictures | 0 |
| Factual slides with valid evidence IDs | 7 / 7 |
| Manual repair time | Not measured |
| Pixel review of benchmark deck | Not performed |

Timing scope is CSV import, source/storyboard validation, PPTX generation, and structural QA. It excludes PDF rendering, human visual review, and human repairs. The unchanged source fixture hash is `83cf15cf61584eb6654d02ea93c13730c3aa984b1c53c4c20dbd55bf7482b76e`; the one-row updated copy hash is `c2adc1b6d04a4648fee958944959b5cb4e4ab90fc90fc4b4b487f9e1883d5164`. The first and updated PPTX hashes are recorded in the raw [benchmark JSON](M4_UPDATE_BENCHMARK.json).

## Runtime

- Windows 11 x64, build `10.0.26300`; AMD Ryzen 9 7945HX; 32 logical CPUs; about 16 GB visible memory.
- Node.js 24.14.0, PptxGenJS 4.0.1, fflate 0.8.3.
- The pipeline is local and offline. The PPTX was structurally inspected, not rendered for this benchmark.

## Interpretation and limits

This is one measured run per stage on synthetic values. Wall time is sensitive to workstation load and is not a stable speed claim. The 8/8 text-slide count, chart/workbook equality, evidence coverage and error-bar equality are structural checks; they do not establish pixel fidelity or interoperability with every office application. Two human ratings, blinded rubric scores, manual repair minutes, and competitor exports remain unmeasured. Do not use these results to compare products or research systems.
