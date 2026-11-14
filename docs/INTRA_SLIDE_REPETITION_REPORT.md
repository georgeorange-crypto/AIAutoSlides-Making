# Intra-slide repetition gate: verification record

## Change

The 40-unit content-page minimum could previously be padded by pasting the same sentence multiple times on one slide. The formal audit now splits authored body copy into sentence/clause fragments, counts exact repeated fragments only once toward the explanation floor, and blocks substantial (12-unit or longer) repeated fragments on a page. The existing cross-page priority repetition check remains in place.

## Adversarial evidence

- `node --test tests/quality-audit.test.mjs` — 33 passed, 0 failed. The new case repeats a 38-Han-character explanation twice; it verifies both the repetition blocker and that de-duplicated copy remains below the 40-unit floor.
- Formal-gate integration: `node --test tests/quality-audit.test.mjs tests/deck-gate.test.mjs tests/presentation-harness.test.mjs tests/approved-storyboard-ir.test.mjs` — 54 passed, 0 failed.
- `node scripts/render-section-structure-fixture.mjs --intra-slide-repeat-stress` — seven-page synthetic deck; S04 contains the same 38-character sentence twice. The formal gate returned `QUALITY_EXPLANATION_REPEATED_WITHIN_SLIDE`, `QUALITY_CONTENT_TOO_THIN`, and `QUALITY_VISIBLE_DENSITY_LOW`. The rendered page was opened and inspected; the repeated line is visibly apparent. PPTX SHA-256: `ad1a8c907bf387c705e7c3b44450462eca4f33b20666d46b1d705f700eaa431b`.
- `npm test` — 341 total, 330 passed, 11 optional-dependency tests skipped, 0 failed. `npm run validate`, `npm run build`, `npm run qa`, and `npm run preview` completed; all seven standard synthetic demo pages were opened and inspected.

## Limits

Exact repetition and short-clause splitting are deterministic. This does not catch every paraphrase or determine whether distinct sentences add new information. Existing near-verbatim checks compare substantial explanations across priority pages; semantic relevance and progression still need human review.
