# Core explanation repetition gate report

Date: 2026-11-13
Branch: `codex/visible-density-gate-20261113`

## Change

Core/high pages in the same declared priority are now checked for exact and near-verbatim reuse across prose, bullets, callouts, and cards. The near-duplicate screen tokenizes Chinese text into adjacent-character pairs and English into words, then blocks when at least 90% of the smaller text's distinctive tokens appear in the other explanation, with a minimum of 30 tokens. This prevents small synonym substitutions from counting as separate depth pages; it does not claim to detect semantic paraphrases with substantially different vocabulary.

## Evidence

- `node scripts/render-section-structure-fixture.mjs --priority-paraphrase-stress` made S04 a lightly synonym-edited copy of S03. The rendered formal quality gate failed with `QUALITY_PRIORITY_EXPLANATION_NEAR_DUPLICATED` for priority `机制解析`, slides S03/S04, measured overlap 0.937 (blocking threshold 0.900).
- Unit adversarial tests cover exact copy, lightly edited Chinese, lightly edited English, and repeated text moved into a bullet list. `node --test tests/quality-audit.test.mjs`: 29 passed, 0 failed.
- `npm test`: 336 tests, 325 passed, 0 failed, 11 optional dependency skips.
- `npm run validate`: passed with the existing three sample-size/source-verification warnings. A seven-page synthetic example was built, structural QA completed with warnings only, its preview rendered, and all seven pages were inspected.

## Limits

Lexical overlap is a narrow signal. It will miss semantic repetition rewritten with sufficiently different words, and may flag highly formulaic passages in the same technical topic. It cannot judge whether a page advances a distinct causal step, interpretation, experiment, or implication; that remains part of the required human page review.
