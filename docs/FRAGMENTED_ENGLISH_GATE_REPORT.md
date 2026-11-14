# Split English passage gate: verification record

## Change

The formal Chinese-deck audit already blocked one English-dominant text block with at least 16 Latin words and less than 35% Han characters. It now also blocks at least two separate fragments that each contain 8–15 Latin words, when their combined count reaches 16 and each remains below the same Han-share threshold. This catches a sustained English explanation divided among short bullets while allowing a short English technical phrase alongside substantial Chinese explanation.

## Evidence

- Unit command: `node --test tests/quality-audit.test.mjs` — 31 tests passed, including split-bullet positive and Chinese-explanation control cases.
- Render command: `node scripts/render-section-structure-fixture.mjs --split-english-stress` — seven-page synthetic PPTX rendered; formal gate reported `QUALITY_ENGLISH_BLOCK_FRAGMENTED` on S04. Density checks also failed because the deliberately short fixture text is sparse; this is an independent expected quality finding.
- Rendered S04 is `outputs/quality-section-structure/run-2026-11-13T23-54-11-124Z/runs/synthetic-sections/presentation-page-4.png`; it visibly contains two short English bullets under a Chinese title. PPTX SHA-256: `d6b417257b8c503057a56d17d5464e49146e9bcc0dec146a64f27fc5ddba503e`.

## Limit

This deterministic screen catches English-dominant fragments only when each has at least 8 detected Latin words. It does not judge whether the remaining Chinese is natural, clear, or well localized; human `language_clarity` review remains required. Passing this check is not a guarantee of presentation quality.
