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
- Phase 2 research integrations are implemented for opt-in OpenAlex/Crossref/arXiv metadata search, local Docling and MarkItDown extraction, single-page Crawl4AI, selected arXiv PDF download, and a one-item Wikimedia Commons asset workflow. These are CLI/local-worker routes, not API workflow actions; extracted claims and asset reuse remain pending human review.
- Phase 3 audience/narrative/media intelligence and rendered-image critic remain planned.
- Phase 4 local stdio MCP server over the loopback API is implemented; full UI, remote auth/scopes and Android remain planned.
- Full Presentation IR element coverage, native Mermaid shape rendering and unchanged-slide hash preservation remain incomplete.
- Transitive dependency, model and media-license audit remains incomplete.

## Phase 2 research, document and asset workflows — 2026-11-12

- Implemented locally: opt-in OpenAlex, Crossref, and arXiv metadata search; local Docling and MarkItDown extraction; one-page Crawl4AI with robots check and constrained same-host browser requests; one selected arXiv PDF downloader; and one-item Wikimedia Commons search/download with retained rights metadata. See `docs/PHASE2_RESEARCH_SEARCH.md` for commands, boundaries and evidence locations.
- Metadata search requires `--allow-network`, caps results and payload size, records response/record hashes and retrieval provenance, and marks every candidate unverified. Abstract text is not copied. Only a selected arXiv result can enter the separate single-PDF download route.
- Extractors emit source and extracted-text hashes, page/element or paragraph locators where supported, and short excerpt candidates with `pending_human_review`. MarkItDown does not provide page coordinates. Docling model downloads are disabled unless explicitly enabled.
- Crawl4AI requires both `--allow-network` and the operator assertion `--site-authorized`; it checks robots, crawls one page, and does not follow links or fetch media. IP checks reject private/reserved endpoints unless an operator explicitly configures a documented egress mapping; any mapping is recorded.
- Wikimedia search is separate from downloading, supports selection of one result only, and preserves source/creator/license/attribution metadata. Every asset is still `needs_human_review`; a declared license is not automatic approval.
- Automated mock and integration coverage: final `npm run test` passed **157/157**, including default-network-off, bounded responses, malformed metadata, arXiv DTD rejection, SSRF rejection, safe download hosts, malformed image/PDF handling and no-overwrite checks.
- Real bounded checks: OpenAlex, Crossref and arXiv each returned two metadata candidates for the generic query `large language models`; one selected arXiv PDF produced 17 page-located excerpt candidates; synthetic local PDFs were extracted with Docling and MarkItDown; one Commons JPEG and one authorized example.com page were retrieved. These are integration checks only. Candidates remain unverified, rights remain pending, and no local research document was sent to a network service.
- Final Phase 2 check on the latest remote revision: `npm run test` passed **157/157**, `npm run validate` and `npm run build` exited 0, `node src/qa.mjs outputs/research-demo.pptx` confirmed 7 editable slides and 1 native chart, and `npm run preview` exited 0 using PowerPoint 16.0 and Poppler 26.07.0. All seven pages were visually inspected. One chart sample-size warning and two unverified evidence entries remain. The latest cover title wraps inside the content column without intruding into the decorative panel.
- Runtime versions are pinned to Docling 2.150.0 and Crawl4AI 0.9.5; MarkItDown 0.1.9 retains its separate isolated environment. The Crawl4AI installer provisions the Playwright Chromium runtime it launches.
- Phase 2's defined implementation slice is complete. API workflow integration, DOI full-text resolution beyond arXiv, bulk media acquisition, MinerU licensing/integration, scientific verification and parser-accuracy evaluation remain planned or out of scope.

## Verification record

The verified Phase 1 snapshot was committed as `ee469885d864c217dae3947b892f48a6e6417228` (`Complete Phase 1 local workflow and project API`) and pushed to `origin/dev`; `git ls-remote` confirmed that exact ref. Additional working-tree edits appeared after that push and are outside this Phase 1 commit.

## Local adapter completion follow-on — 2026-11-12

- `pptxgenjsAdapter.run()` now calls the validated Presentation IR pipeline; output includes editable PPTX, exact chart QA, lineage, run manifest and evidence sidecars.
- Presentation IR image elements use position/alt text and a declared local asset. PptxGenJS checks MIME, SHA-256, 25 MB size, workspace containment, symlink paths and risky SVG markup. Rights state is never auto-approved.
- Slidev now has `runIR()` and `npm run render:slidev-ir`; it stages local image assets and renders PDF/PNG. A real 9-page synthetic PDF and nine PNGs were generated. Editable PPTX for the richer image/process fixture was stopped by QA after Slidev produced 0 editable-text slides.
- Automated local checks are rerunning. Human visual sign-off, scientific verification, real-source OCR accuracy review, blind human scores, manual repair timing and cloud/API account actions were explicitly skipped.
