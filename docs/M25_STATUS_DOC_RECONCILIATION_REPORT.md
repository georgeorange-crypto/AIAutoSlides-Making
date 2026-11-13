# M25 — Reconcile current capability descriptions

Date: 2026-11-12

## Delivered

- Updated the research matrix to distinguish embedded SVG picture objects from separately implemented native editable architecture shapes/connectors.
- Updated the active implementation status to include API excerpt-review records and exact matching over supported local text, selectable PDF and DOCX sources. Human identity authentication, semantic claim entailment and scientific verification remain unimplemented.
- Clarified the historical M21/M23 boundaries in the capability QA document so they do not contradict M24.
- Corrected the schema QA summary: object-bound and overlap checks, small-font warnings and theme contrast checks exist; target-system font substitution and visual/scientific issues still need human review.
- Corrected the research matrix's outdated root dependency list and the schema review description that still implied the evidence API never reads local source bytes.
- Updated the matrix's preview statement to reflect the latest rendered-and-inspected synthetic deck while keeping review status tied to each deck revision.
- Kept dated milestone reports as historical records instead of rewriting what those earlier stages delivered.

## Verification

- Searched active docs for stale “not implemented”, “remaining”, “planned” and milestone claims, then compared touched descriptions with the current API, renderer, QA implementation and M21–M24 reports.
- Checked local Markdown links introduced or touched in the status sections; all referenced local documents exist.
- No runtime code or schemas changed in this documentation reconciliation stage.

## Remaining

- The project-wide roadmap is not complete: Phase 0 candidate bakeoff, broader Phase 3 intelligence, complete Presentation IR coverage, native Mermaid rendering, authenticated multi-user UI, unchanged-slide hash preservation, and full transitive/media/model license review remain separate open work. See `docs/IMPLEMENTATION_STATUS.md` and `docs/INTEGRATION_STATUS.md`.
