# Phase 1 local API end-to-end evidence

This folder preserves the default-preview API workflow run from 2026-11-12. It is a synthetic contract fixture, not research evidence or an empirical result.

## Reproduce

From the repository root, start the loopback API and create a project with `input.presentation-ir.json`, then enqueue a job without `{ "preview": false }`. The workflow renders the editable PPTX, runs structural QA, exports the PDF and three PNG pages, and writes lineage, review, critique, event and run manifests. The REST test `node --test tests/api.test.mjs` exercises project creation, edits, source hashing/path controls, artifact export/download and restart handling; manual default-preview evidence is recorded in this folder.

## Recorded environment

- Windows; Node.js v24.14.0; SQLite 3.51.2 via Node's built-in `node:sqlite`.
- PptxGenJS 4.0.1; PowerPoint 16.0; `pdftoppm` 26.07.0.
- No network research, model/API call, credential, or paid service was used.
- Project ID: `c9d99a5a-421b-4ba5-8e4d-a504a67d95eb`.
- Job ID: `f9b72ea9-d0bf-4988-8aea-16bd953e6ce2`.
- Result: completed; 3-slide editable PPTX; 1 native chart; chart values exactly match `[12,18,15]`; all three rendered PNG pages were visually inspected.
- The input source is deliberately unverified. QA warns on that state and on absent chart sample-size metadata. Scientific accuracy is `not_assessed`; visual approval is a human review state, not inferred from successful rendering.

`artifact-manifest.json` records SHA-256 hashes for the preserved input, PPTX, PDF, screenshots and reports. The SQLite database is not copied here because its persisted paths refer to the original local workspace; tests create a fresh database and exercise restart behavior.
