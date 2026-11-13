# Approved assertion binding report

Date: 2026-11-13
Branch: `codex/visible-density-gate-20261113`

## Change

The formal Harness now binds each included Presentation IR page headline to the approved page-map `assertion`. It compares `assertion_title`, falling back to `title`, after Unicode NFC normalization and whitespace collapsing. Missing or changed headline text is rejected before rendering. This closes a plan-to-output gap; it does not assess whether the approved assertion is useful or accurate.

## Evidence

- `src/harness.mjs` calls `assertApprovedDeckPlan` when the formal `--deck-plan` route is selected.
- `node --test tests/deck-gate.test.mjs tests/approved-storyboard-ir.test.mjs`: 11 passed, 0 failed. The adversarial checks reject a rewritten or missing IR headline and accept equivalent whitespace; the approved synthetic storyboard still compiles and passes Presentation IR validation.
- `npm test`: 337 tests, 326 passed, 0 failed, 11 optional dependency checks skipped.
- `npm run validate`: passed with three existing sample-size/unverified-evidence warnings. `npm run build` created the seven-page synthetic demo; `npm run qa` reported a warning (7 editable-text pages, 1 native chart); `npm run preview` rendered all seven pages with PowerPoint 16.0 and Poppler 26.07.0. Every preview page was inspected. The gate change does not modify slide rendering.

## Limits

This prevents an approved assertion from silently drifting between plan and generated IR, and prevents an absent assertion from passing this check. It cannot tell whether a matching headline is informative, natural, evidence-supported, or well explained by the body. Those remain content and human-review responsibilities.
