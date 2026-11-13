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
- Phase 2 research integrations are implemented for opt-in OpenAlex/Crossref/arXiv metadata search through CLI, local REST and stdio MCP, including project-scoped candidate persistence, explicit unverified source registration, pending evidence excerpts, and caller-supplied excerpt review records. Local exact-source matching covers supported text, selectable PDF and DOCX content; these matches do not assess entailment. Local Docling and MarkItDown extraction, single-page Crawl4AI, selected arXiv PDF download, and a Wikimedia Commons workflow for one item or a bounded selection of up to five images remain CLI/local-worker routes. Extracted claims and asset reuse remain pending human review.
- Phase 3 audience/narrative/media intelligence and rendered-image critic remain planned.
- Phase 4 local stdio MCP server over the loopback API is implemented; full UI, remote auth/scopes and Android remain planned.
- Full Presentation IR element coverage, native Mermaid shape rendering and unchanged-slide hash preservation remain incomplete.
- Transitive dependency, model and media-license audit remains incomplete.

## Phase 2 research, document and asset workflows — 2026-11-12

- Implemented: opt-in OpenAlex/Crossref/arXiv metadata search via CLI, loopback REST and stdio MCP; project-scoped search candidate persistence and explicit source registration; API/MCP insertion of user-supplied exact evidence excerpts in pending state; local Docling and MarkItDown extraction; single-page Crawl4AI with robots check, same-host requests and URL/IP safeguards; selected single-paper arXiv PDF download; and separately selected one-to-five-item Wikimedia Commons media retrieval. Commands and safety boundaries are documented in `docs/PHASE2_RESEARCH_SEARCH.md` and `docs/API_WORKFLOW.md`.
- Retrieval and extraction artifacts include source identifiers, URLs or local locators, retrieval time, source/response/content hashes where applicable, and short excerpt candidates. Candidates remain unverified and asset rights remain pending human review.
- The existing local document importer also provides offline PDF OCR, DOCX body/header/footer text and image extraction, and PDF inline-image/image-XObject extraction with hashes and source locators. PDF masks/soft masks, uncommon sample formats and DOCX comments/tracked-deletion semantics remain unsupported.
- Search/download boundaries are explicit: network calls require opt-in; image search does not download files; one selected arXiv paper or a selected Commons batch of at most five images can be downloaded per command; web crawl does not traverse links or fetch media.
- Docling 2.150.0 and Crawl4AI 0.9.5 are pinned in the isolated Python runtime. Docling model downloads are opt-in. Crawl4AI requires its locally installed Playwright Chromium. MarkItDown 0.1.9 uses its separate isolated worker.
- Phase 2 is complete for these bounded integration slices. The API can store caller-supplied human excerpt-review decisions but does not authenticate reviewer identity or assess semantic entailment. General DOI full-text resolution outside Europe PMC, unbounded media acquisition, MinerU integration/licensing, automated scientific verification and parser-accuracy evaluation remain planned or out of scope.
- The prior combined `npm run check` record on the PDF/DOCX asset and cover-layout update is exit 0 with 153/153 tests and the synthetic import/build/QA sequence. On the M12/PDF-DOCX revision, I separately reran the full suite: `npm run test` passed **157/157**; `npm run validate` and `npm run build` exited 0; `node src/qa.mjs outputs/research-demo.pptx` confirmed 7 editable slides and 1 native chart; `npm run preview` rendered seven pages using PowerPoint 16.0 and Poppler 26.07.0, and each page was visually inspected. One chart sample-size warning and two unverified evidence entries remain. The cover title wraps within the content column without intruding into the decorative panel; human design approval remains pending.

## Verification record

The verified Phase 1 snapshot was committed as `ee469885d864c217dae3947b892f48a6e6417228` (`Complete Phase 1 local workflow and project API`) and pushed to `origin/dev`; `git ls-remote` confirmed that exact ref. Additional working-tree edits appeared after that push and are outside this Phase 1 commit.

## Local adapter completion follow-on — 2026-11-12

- `pptxgenjsAdapter.run()` now calls the validated Presentation IR pipeline; output includes editable PPTX, exact chart QA, lineage, run manifest and evidence sidecars.
- Presentation IR image elements use position/alt text and a declared local asset. PptxGenJS checks MIME, SHA-256, 25 MB size, workspace containment, symlink paths and risky SVG markup. Rights state is never auto-approved.
- Slidev now has `runIR()` and `npm run render:slidev-ir`; it stages local image assets and renders PDF/PNG. A real 9-page synthetic PDF and nine PNGs were generated. Editable PPTX for the richer image/process fixture was stopped by QA after Slidev produced 0 editable-text slides.
- Automated local checks are rerunning. Human visual sign-off, scientific verification, real-source OCR accuracy review, blind human scores, manual repair timing and cloud/API account actions were explicitly skipped.

## Local Agent integration follow-on — 2026-11-12

- `src/mcp.mjs` exposes the loopback REST project workflow through stdio MCP. The API must be started separately; this server is not remote, authenticated or multi-user.
- One shared evidence-first presentation Skill is available to Codex at `.agents/skills/aiautoslides/` and Claude Code at `.claude/skills/aiautoslides/`; both are checked against `skills/aiautoslides/SKILL.md` by an automated test.
- The Skill uses local deterministic import, validate, build, structural QA and preview commands. It requires review of every rendered page and keeps scientific verification and human visual approval pending until performed.
- Optional AI planning and scholarly search remain separate opt-in network workflows. The Skill does not invoke them, and source evidence/metadata is never promoted to verified automatically.

## Local DOCX image extraction follow-on — 2026-11-12

- `src/document-assets.mjs` optionally extracts PNG/JPEG/SVG image parts referenced by DOCX body/header/footer; `src/pdf-assets.mjs` decodes PDF image XObjects to PNG. External DOCX relationships and paths outside `word/media/` are ignored; images are deduplicated by SHA-256 and bounded by per-image, aggregate-size, image-count and page-count limits.
- `node src/import-document.mjs --extract-images` writes copied assets and an `--assets`-compatible JSON manifest with document SHA-256, source part, relationship IDs, alt text when available, MIME type, and `verified:false` inherited rights state.
- Unit/integration coverage checks DOCX body/header/footer text and PNG/JPEG/SVG plus PDF inline image/XObject extraction, duplicate handling, exact hashes, manifest loading/slide association, embedded PPTX objects, and external/path-traversal rejection. PDF masks/soft masks, uncommon sample formats and DOCX comments/tracked-deletion semantics remain unimplemented.
- Detailed stage results: `docs/M9_DOCX_ASSET_EXTRACTION_REPORT.md`, `docs/M10_PDF_ASSET_EXTRACTION_REPORT.md`, `docs/M11_DOCX_HEADER_FOOTER_ASSETS_REPORT.md`, and `docs/M12_COVER_LAYOUT_CORRECTION_REPORT.md`.

## PDF inline image extraction follow-on — 2026-11-12

- `src/pdf-assets.mjs` extracts supported PDF.js inline-image and inline-image-group operators to bounded PNG assets alongside image XObjects. Group placement counts, page/operator locators, PDF SHA-256 and pending rights/verification state are retained.
- Synthetic repeated-inline-image integration verifies deterministic pixel decoding, content deduplication, CLI manifest output, and PPTX picture embedding. Masks/soft masks, uncommon sample formats, and semantic figure association remain unsupported.
- At the first M13 attempt, PowerPoint COM timed out and LibreOffice was absent. A preview rerun on the M14 descendant succeeded with PowerPoint 16.0 and Poppler; all seven pages were inspected (see the latest validation note below).
- Detailed stage results: `docs/M13_PDF_INLINE_IMAGE_EXTRACTION_REPORT.md`.

## DOCX header/footer text follow-on — 2026-11-12

- `src/document-extractors.mjs` now extracts paragraphs from headers/footers only when the main document references those parts, with stable package-part locators. The body paragraph locator sequence remains unchanged.
- Tests cover referenced header/footer extraction, relationship resolution, orphan-part exclusion, source bundle content and the unchanged native deck import path. Tables remain linearized; comments and tracked-deletion semantics are not extracted.
- Detailed stage results: `docs/M14_DOCX_HEADER_FOOTER_TEXT_REPORT.md`.

- M14 full validation: `npm test` passed 158/158; `npm run validate`, `npm run build`, `npm run preview`, and `node src/qa.mjs outputs/research-demo.pptx` all completed successfully. PowerPoint 16.0 and Poppler 26.07 rendered the 7-slide demo to PDF and seven PNGs; each page was inspected. QA reported 7 editable-text slides and one native chart. Existing evidence/sample-size warnings remain, and human approval is still pending.

## Asset usage suggestion follow-on — 2026-11-12

- Added `npm run assets:suggest` for deterministic, explainable lexical candidate ranking between slide copy and optional asset metadata. It reports matched terms, current associations, and source/license/verification review flags without changing slides or verification state.
- This is not image-semantic matching, license review, or evidence entailment. Audio/video management, semantic matching, rights validation, generic DOI full-text workflows outside Europe PMC, unbounded media acquisition, and MinerU evaluation remain incomplete.
- Detailed implementation and limitations: `docs/M15_ASSET_USAGE_SUGGESTION_REPORT.md`.

## Europe PMC DOI full-text follow-on — 2026-11-12

- Added an opt-in single-DOI import for exact Europe PMC records marked open access and carrying a PMC ID. The importer keeps JATS XML, source and metadata hashes, paragraph locators, and unverified evidence locally; rights remain pending review.
- This does not provide generic publisher DOI resolution or PDF downloads. See `docs/M16_DOI_FULLTEXT_EUROPEPMC_REPORT.md` for test and scope boundaries.

## Wikimedia Commons batch import follow-on — 2026-11-12

- Added an explicitly selected batch download of at most five Wikimedia Commons images and 50 MiB total. Provenance and rights metadata are kept per file, duplicate bytes fail the batch, and every asset remains pending human rights review.
- This is a limited batch adapter, not web crawling or unbounded media collection. See `docs/M17_COMMONS_BATCH_IMPORT_REPORT.md`.

## REST/MCP scholarly metadata search follow-on — 2026-11-12

- Added `POST /research/search` and the `aiautoslides_research_search` MCP tool over the existing OpenAlex/Crossref/arXiv metadata adapter. Both require an explicit `allow_network:true`; provider/query/result-limit validation runs at the API boundary.
- Results remain unverified metadata candidates and do not create project evidence, download full text, verify claims or call a model. Mocked integration checks cover the network gate and response state. See `docs/M18_API_RESEARCH_SEARCH_REPORT.md`.
- Generic DOI full-text retrieval outside the Europe PMC slice, web crawling, and scientific claim verification remain incomplete.

## Project research candidate registration follow-on — 2026-11-12

- Project-scoped REST/MCP search now stores bounded provider result records locally, exposes a candidate list, and allows explicit registration of one selected result as a source in Presentation IR. Search remains network opt-in; registration preserves provider/query/record hash and stays unverified.
- Source registration creates no evidence excerpt, claim, or verification state. See `docs/M19_PROJECT_RESEARCH_CANDIDATES_REPORT.md` and `docs/SCHEMA.md`.

## Pending evidence excerpt follow-on — 2026-11-12

- Project REST/MCP can list evidence records and accept a user-supplied exact excerpt tied to a known source ID and locator. New entries are always `pending`; supplied verification status is ignored, unknown source IDs and duplicate evidence IDs fail.
- The API does not inspect source bytes or verify excerpt fidelity/claim entailment. See `docs/M20_PENDING_EVIDENCE_EXCERPTS_REPORT.md`.

## Human evidence excerpt review follow-on — 2026-11-12

- Project REST/MCP now records a caller-supplied `verified` or `contradicted` excerpt review bound to the current excerpt SHA-256, with reviewer text and timestamp. Stale content and repeated final decisions are rejected.
- Reviewer identity is not authenticated; this does not verify source status or claim entailment. See `docs/M21_EVIDENCE_REVIEW_REPORT.md`.

## Stale evidence review invalidation follow-on — 2026-11-12

- General Presentation IR updates now return reviewed evidence to `pending` if its excerpt, source ID or locator changes, while retaining the previous reviewer, decision and content hash as stale audit history. Re-review clears the stale decision marker.
- See `docs/M22_STALE_EVIDENCE_REVIEW_REPORT.md`.

## Local source excerpt matching follow-on — 2026-11-12

- Evidence responses now compare excerpts verbatim against bounded, imported UTF-8 text source blobs and return a source hash, match count/offset, no-match, or a specific unavailable reason. The evidence and parent source remain pending/unverified.
- Binary sources, PDF/DOCX extraction alignment, OCR and semantic claim support remain outside this exact-text check. See `docs/M23_LOCAL_EVIDENCE_SOURCE_MATCH_REPORT.md`.

## Selectable PDF/DOCX source matching follow-on — 2026-11-12

- The project evidence API now uses the existing local PDF.js and DOCX extractors to match exact excerpts in selectable PDF page text and DOCX paragraphs, returning the extracted locator. OCR remains opt-in and is not called by this check; missing blobs and parse failures remain `unavailable` instead of inferred matches.
- See `docs/M24_PDF_DOCX_EVIDENCE_MATCH_REPORT.md` for regression and remaining limits.

## Capability status reconciliation — 2026-11-12

- Corrected current-status statements that had been superseded by later implementation: API excerpt review, local selectable PDF/DOCX matching, and native architecture rendering. Earlier milestone reports remain historical records of their original scope.
- The source-match/reviewer boundary now consistently distinguishes a verbatim provenance check from a caller-supplied human decision and from semantic scientific verification. Remaining phase-wide gaps are still listed as incomplete rather than implied complete.
- See `docs/M25_STATUS_DOC_RECONCILIATION_REPORT.md`.
