# Deep explanation stage gate report

Date: 2026-11-13
Branch: `codex/visible-density-gate-20261113`

## Change

Deep content priorities now require each mapped core/high page in the approved plan to declare one `explanation_stage`: `question`, `mechanism`, `evidence`, `comparison`, `result`, `implication`, `boundary`, or `synthesis`. A deep topic must cover at least four distinct stages. The plan gate checks this before approval; the independent full-deck quality audit checks it again and emits `QUALITY_PRIORITY_STAGE_MISSING` or `QUALITY_PRIORITY_STAGE_DIVERSITY` if the final run does not meet the contract. Standard priorities are unchanged.

## Evidence

- `node --test tests/deck-gate.test.mjs tests/quality-audit.test.mjs`: 38 passed, 0 failed. Tests cover a seven-page deep plan with seven stages, repeated use of one stage, missing stage metadata, and the final audit's independent check.
- `node scripts/render-section-structure-fixture.mjs --priority-stage-stress`: rendered a 10-page synthetic deck with seven core pages mapped to the deep `机制解析` priority, all declared as `mechanism`. The formal quality gate reported `QUALITY_PRIORITY_STAGE_DIVERSITY`, with one distinct stage against a minimum of four. It also reported independent fixture issues: an OCR miss on the visible section roadmap, two pages below the text-density threshold, and repeated process-page composition. Those additional findings are not attributed to the stage gate. The section roadmap cards were visible when all 10 PNGs were inspected. Stress PPTX SHA-256: `9a3298aeefbe03cc31ac42ca61f0b1ac22915f154b0c7762182aab348eb062fe`.
- `npm test`: 337 tests, 326 passed, 0 failed, 11 optional dependency checks skipped.
- `npm run validate`: passed with three existing sample-size/unverified-evidence warnings.
- `npm run build`: produced the seven-page synthetic demo. `npm run qa` completed with a warning (7 editable-text slides, 1 native chart); `npm run preview` rendered all seven pages using PowerPoint 16.0 and Poppler 26.07.0. All seven PNGs were inspected.

## Limits

Stage diversity is a page-map contract, not a semantic classifier. It cannot prove that a page truly explains the named stage, that the chosen priorities are correct, or that the explanation is scientifically accurate. Human plan approval and per-page `emphasis_depth` review remain necessary. The stress fixture's OCR, density, and layout findings also show that a deck may fail for several independent reasons; passing the stage check alone would not constitute deck acceptance.
