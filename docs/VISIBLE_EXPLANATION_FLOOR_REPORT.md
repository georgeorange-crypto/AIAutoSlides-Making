# Visible explanation floor: verification record

## Change

Formal deck plans can no longer set `minimum_explanation_units` below 40 for content pages. The rendered quality audit independently applies the same non-lowerable floor, even if called with a plan that declares 18 or omits the value. Units count each Han character and each non-Han word once. Covers, agendas, section transitions, and endings retain their separate checks; visual pages still need rendered body-text density and meaningful visual coverage.

## Adversarial evidence

- `node --test tests/deck-gate.test.mjs tests/quality-audit.test.mjs tests/presentation-harness.test.mjs tests/approved-storyboard-ir.test.mjs` — 53 passed, 0 failed. Includes a plan declaring 18 with a short content page and verifies that the effective audit floor remains 40.
- `node scripts/render-section-structure-fixture.mjs --explanation-floor-stress` — seven-page synthetic deck; S04 has 38 Han-character explanation units. The formal gate failed S04 with both `QUALITY_CONTENT_TOO_THIN` (minimum 40) and `QUALITY_VISIBLE_DENSITY_LOW` (one line, 2.58% occupancy). S04 was opened and visually inspected. PPTX SHA-256: `4fad016f01f3488716bdf3a93a584d8611a42a43a4bb9b50246fa16d5c00b665`.
- `npm run validate`, `npm run build`, `npm run qa`, and `npm run preview` all completed for the seven-slide synthetic demo. Seven pages were opened and inspected.
- Full `npm test` ran 340 tests: 328 passed, 11 optional integrations skipped, and one unrelated offline PDF OCR test failed because its child process timed out after 120 seconds (`spawnSync.status` was null). The focused formal-gate and Harness suites pass; the full suite is therefore not reported as green.

## Limits

Forty units prevents extremely short body copy from passing only because the slide has a headline or large shapes. It cannot establish that the explanation is relevant, correct, well prioritized, or worth the space; human review still has to judge those. Plans may choose a higher content floor up to 120 units.
