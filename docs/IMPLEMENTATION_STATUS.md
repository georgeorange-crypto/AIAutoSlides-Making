# Implementation status — Phase 1 complete

## Phase 1 deliverables

### Implemented

- `packages/core` defines Project, UserProfile, Source, Evidence, Asset, Claim, SlideIR, DeckIR, JobState, safe slide-IR patches, semantic validation and legacy storyboard/evidence migration. Project, job, source/evidence, run-manifest and presentation contracts are versioned JSON Schemas.
- `packages/adapters` has a versioned PresentationAdapter contract with required `probe`, `capabilities`, `render`, `edit`, `export` and `cancel` operations. PptxGenJS IR supports validated slide patches, native editable PPTX generation, lineage/QA/run manifests, immutable artifact export and explicit stage-boundary cancellation limits. Slidev remains a tested secondary rendering engine with documented SVG/chart/editability limits.
- `packages/workflow` implements local IR import/validation, supplied-evidence inventory, deterministic content and visual plans, capability negotiation, PPTX generation, structural QA, optional PDF/PNG preview, human-review gating, export, JSONL events and a durable run report. Network research is explicitly disabled in this workflow; inventory never verifies facts.
- `packages/api` provides a loopback-only REST API for projects, incoming source files, slides/IR edits, jobs/status/cancel, artifacts and downloads. SQLite stores project revisions, source metadata, slide snapshots, job states/events and artifact hashes. Raw imported source bytes are immutable and stored at `source-blobs/<sha256>`; downloads verify hashes.
- Restart handling requeues persisted queued jobs and marks interrupted running jobs failed with an explanation. Preview is optional per job. PptxGenJS in-process rendering is not hard-cancellable; cancellation is honored between workflow stages.
- The legacy CLI remains supported. The API requires Node.js 22.5+ for built-in `node:sqlite`; the legacy CLI retains the package's declared minimum runtime.

### Tested

- `npm run test`: **exit 0; 116/116 passed, 0 failed**.
- `npm run validate`: **exit 0**; legacy 7-slide research example passed with three explicit warnings (missing chart sample size; E1/E2 unverified).
- `npm run build`: **exit 0**; legacy 7-slide deck and review report generated.
- `npm run preview`: **exit 0**; PowerPoint 16.0 plus pdftoppm rendered 7 PNG pages; all 7 visually inspected with no apparent clipping/overlap.
- `npm run api -- --help`: **exit 0**; API command help returned successfully.
- API default-preview end-to-end: **exit 0**; local project and job traversed all 8 workflow stages, generated PPTX/PDF/3 PNG pages, QA, lineage, export copies and JSONL logs (21 artifact records). All 3 API-run PNG pages were visually inspected. The input, deck, previews, reports and SHA-256 manifest are preserved in `artifacts/phase1-api-e2e/`. Job ID: `f9b72ea9-d0bf-4988-8aea-16bd953e6ce2`; native PPTX SHA-256: `3610b1a7bbecd27393da6b0168a413e5beed7afaf8708f01a38bc30e7a848029`.
- `node --test tests/api.test.mjs tests/presentation-ir.test.mjs`: targeted API/IR suite passed; these tests are included in the 116-test full run.
- API integration covers project persistence, content-addressed source import, path boundary rejection, slide patch validation, job rendering, export/download hash verification, queued-job recovery and interrupted-job failure handling.
- PptxGenJS IR end-to-end smoke test passes with native chart/value parity; source verification warnings remain visible. Slidev's separate successful local export and limitations are documented in `docs/SLIDEV_ADAPTER.md` and `docs/TOOL_MATRIX.md`.
- Legacy example and IR deck have previously passed validation/build, OOXML QA and PowerPoint→PDF→PNG rendering with all pages visually inspected. The current final render will be recorded after this revision's full verification.

### Demo-only and not claimed

- Research/evidence stage only inventories caller-supplied evidence. It does not crawl, retrieve papers, extract new claims or make scientific verification decisions.
- Content and visual plans are deterministic summaries of supplied IR, not AI-generated audience/narrative/media optimization.
- Critic stage reports structural/data QA and sets scientific accuracy to `not_assessed`; visual approval remains `pending_human` after preview.
- Slide patch changes the versioned IR. Re-render rebuilds the deck; unchanged slide output hashes are not guaranteed.
- The REST API is local, single-user and single-process. It is not authenticated for remote access, sandboxed at the OS level, or suitable for reverse-proxy exposure.

## Phase 1 exit checks

- Versioned IR contracts and migration: implemented.
- PptxGenJS adapter and a successfully run secondary engine: implemented/tested.
- Import→evidence inventory→content/visual plan→generation→preview→critic→export workflow with durable status/logging: implemented locally.
- REST project/job/artifact/slides/edit endpoints and SQLite persistence: implemented locally.
- Native editable PPTX, source lineage, QA, hashes, screenshots and human-review state: generated as local reproducible artifacts; scientific verification remains separate.

## Remaining beyond Phase 1

- Phase 0 bakeoff is incomplete for some requested engines/task groups; blocked and unrun candidates remain identified in `docs/POC_RESULTS.md`.
- Phase 2 research/document extraction, OpenAlex/Crossref/arXiv retrieval, web crawl and licensed media integrations remain planned/blocked; none are called by this API.
- Phase 3 audience/narrative/media intelligence and rendered-image critic remain planned.
- Phase 4 MCP, full UI, remote auth/scopes and Android remain planned.
- Full Presentation IR element coverage, native Mermaid shape rendering and unchanged-slide hash preservation remain incomplete.
- Transitive dependency, model and media-license audit remains incomplete.

## Verification record

The current verified workspace is branch `dev`, based on `723424f` (`origin/dev`, after fetching the remote's concurrent adapter/AI-contract updates). Remote publication is recorded here only after the final review, commit and push.
