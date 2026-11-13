# M22 — Invalidate evidence reviews after content edits

Date: 2026-11-12

## Delivered

- `savePresentationIR` compares each updated evidence record to its previous content binding (evidence ID, source ID, excerpt and locator).
- When reviewed content changes, current `verification_status` becomes `pending` and `review_stale:true` is recorded. The prior reviewer, timestamp, reviewed SHA-256 and decision are preserved as audit history.
- A new review must use the current content hash. Successful review clears the stale decision marker and writes a new reviewer/time/hash.
- Evidence changes that do not alter the bound fields do not invalidate review. Source records are not changed.

## Verification

- `node --test tests/api.test.mjs tests/mcp.test.mjs`: PASS (9 tests, including change-after-review invalidation and re-review).
- `npm test`: PASS (174/174).
- `npm run check`: reached and completed the final critique report stage after 174/174 tests, critic evaluation, update benchmark, Markdown/CSV imports, validation, PPTX builds and QA. Synthetic unverified-evidence warnings were preserved.
- Rebuilt the synthetic 10-slide acceptance PPTX; PowerPoint 16.0 and Poppler 26.07.0 produced a 10-page PDF and ten PNGs. QA: 10 slides, all 10 text-editable, one native chart; intentional synthetic evidence warnings remain.
- Opened and inspected all ten PNGs. No clipping beyond page bounds or major overlap was visible. Human project-owner visual sign-off remains pending.

## Boundaries

- Reviewer labels remain unauthenticated caller text; no source authenticity or claim entailment check is performed.
- This invalidation applies to updates passing through the project's `savePresentationIR` path, including the API slide edit workflow and store updates. Direct external edits to content-addressed IR files are outside the supported write path.
