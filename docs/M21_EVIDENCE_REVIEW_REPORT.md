# M21 — Human review for evidence excerpts

Date: 2026-11-12

## Delivered

- REST `GET /projects/{id}/evidence` and evidence creation return `content_sha256` bound to the evidence ID, source ID, exact excerpt and locator.
- REST `POST /projects/{id}/evidence/{evidence_id}/review` records a caller-supplied `verified` or `contradicted` decision, reviewer label, timestamp, bound hash and optional note.
- Hash mismatch (including edits made through a later Presentation IR revision) and attempts to replace a final review fail with HTTP 409. Invalid decision/reviewer/note inputs fail closed.
- MCP exposes `aiautoslides_review_evidence`; its schema restricts decisions and lengths and requires the content hash. MCP instructions explicitly classify excerpt review as a write requiring user approval.
- A review does not change the source record's verification state.

## Verification

- `node --test tests/api.test.mjs tests/mcp.test.mjs`: PASS (9 tests, 0 failures), including stale hash, wrong hash, duplicate final review, verified and contradicted states, and unchanged source state.
- `npm test`: PASS (174/174).
- `npm run check`: PASS on retry; 174/174 tests plus critic evaluation, benchmark update, Markdown/CSV imports, validation, PPTX builds and QA. The first run had a transient `ECONNRESET` in the existing Canva OAuth callback test (173/174); the second complete run passed.
- Synthetic acceptance deck rebuilt as a 10-slide PPTX; PowerPoint 16.0 exported a 10-page PDF and Poppler 26.07.0 rasterized ten PNGs. Structural QA reports 10 slides, all ten text-editable, one native chart, with warnings because synthetic source material is intentionally unverified.
- All ten rendered PNGs were opened and visually inspected. No slide-boundary clipping or major overlap was visible. Human project-owner sign-off is still pending; the sample imagery is explicitly illustrative and remains image objects, while the architecture/process elements are native editable objects.

## Boundaries and remaining risks

- Reviewer identity is caller-supplied text; the local API has no authentication or role management.
- A `verified` value means a human reports having checked the excerpt. The service does not fetch/check original source bytes, assess source authenticity, or verify claim entailment.
- This API currently offers no excerpt-specific edit operation. General Presentation IR updates can change evidence; the content hash prevents review of a stale revision but callers must submit a new decision against the new hash.
- The ten-slide deck is synthetic/hypothetical, not empirical evidence. Its warning states are expected and must not be cleared without source review.
