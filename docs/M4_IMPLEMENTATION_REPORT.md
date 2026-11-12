# Milestone 4 — Local source import, first tranche

**Status:** Offline `.docx`, selectable-text `.pdf`, and opt-in scanned-PDF OCR are implemented behind `src/import-document.mjs`. PDF.js (`pdfjs-dist`, Apache-2.0) is the bundled local fallback when Poppler is absent; Poppler remains preferred for layout-preserving selectable-text extraction. OCR uses bundled Tesseract.js 7 and bundled `eng`/`chi_sim` traineddata after local Poppler rasterization. Import artifacts preserve local-source hashes, extracted-text hashes, page/paragraph locators, OCR confidence, and explicitly unverified evidence. No cloud upload or paid service is used.

## Delivered

- `npm run import:document -- --input <file.pdf|file.docx> --id E_LOCAL_SOURCE [--evidence ledger.json] [--out-prefix outputs/imports/source]` writes quoted extracted text (`.md`), an evidence ledger (`.evidence.json`), and extraction manifest (`.manifest.json`). Existing ledgers are copied and appended in the output; inputs are not modified.
- DOCX paragraphs and table-cell paragraphs are extracted in document order using the existing `fflate` dependency. Paragraph numbering is retained as a locator. Headers/footers, comments, tracked-deletion semantics, and OCR of embedded images are not extracted; complex table layout is linearized.
- PDF selectable text uses Poppler `pdftotext -layout` when available or bundled Mozilla PDF.js offline; both paths retain page locators and reject documents with no selectable text. PDF.js line assembly follows text-item geometry and reading order, which can differ from visual columns; compare extracted text with the original rendered pages. Image-only/scanned PDFs fail with a clear OCR-not-performed message.
- Source and normalized-extraction SHA-256 values are recorded. Imported evidence is always `verified:false`; generated Markdown quotes source text and marks it as untrusted data, not instructions.
- Tests create a synthetic DOCX and exercise CLI import → evidence ledger → storyboard validation/build. PDF.js CLI integration is forced in tests (so it does not depend on Poppler), and Poppler page parsing, blank-page locators and no-text rejection are covered.

## Verification

- `npm test`: **40/40 passed**, including end-to-end synthetic DOCX import → evidence ledger → storyboard/PPTX build and an actual local selectable-text PDF import (Poppler present on this workstation).
- `npm run check`: passed, including all importer tests, M1/M2 generation and QA, dual-deck build, and offline Slide Critic evaluation. Existing unverified/synthetic evidence warnings remain visible.
- `npm run import:document -- --help`: passed. Negative unsupported-format invocation returned nonzero with `Supported local formats are .pdf and .docx`.
- `npm run preview`: rendered the existing 7-slide keynote demo to PDF and seven PNG files; each page was manually inspected. No visual changes were introduced by the local source adapter.
- DOCX integration test confirms the evidence record is `verified:false`, source hash matches the exact source bytes, paragraphs/table-cell text retain order/locators, and the linked storyboard builds to PPTX.
- PDF.js integration test confirms local selectable-text extraction, page locators, source hash and `verified:false` status from a generated synthetic one-page PDF without invoking Poppler. The parser tests retain blank-page locators and reject image-only/no-text input with the OCR limitation.
- `git diff --check`: passed; Git emitted only line-ending normalization notices.

## Update-pipeline benchmark tranche

- Added `npm run benchmark:update` to `npm run check`. It only accepts the bundled fixture when it is explicitly marked `SYNTHETIC`, changes one value from 52 ms to 53 ms, then runs first build and second refresh through import, validation, PPTX build and structural QA.
- Recorded one local run in [`M4_UPDATE_BENCHMARK.md`](M4_UPDATE_BENCHMARK.md): first run **1,486 ms**, one-row update **1,368 ms**. Exactly one observation changed; no rows were added or removed.
- Both 8-slide decks had 8/8 editable-text slides, one native chart, one native error-bar series, zero raster pictures, exact chart/workbook values and exact error-bar data. Seven factual slides had valid evidence IDs (7/7). These measurements do not include human repair time or rendered visual review.
- Raw machine-readable result includes source and PPTX SHA-256 hashes, runtime/dependency versions and machine details. Results are synthetic and from a single run; do not use as a product performance claim.

## Scope limits / next M4 work

- Scanned-PDF OCR is opt-in. Engine and English/Simplified Chinese data are bundled npm dependencies; local Poppler `pdftoppm` remains required for rasterization. OCR remains unverified.
- This adapter extracts text and provenance; it does not automatically create claims, slides, or verify claim-to-source entailment.
- An optional open-source export backend was evaluated on a three-slide synthetic fixture. Slidev `pptx-editable` preserved editable text with no raster pictures in this case, but rendered with weaker theme/layout fidelity and did not provide the project's evidence lineage or chart QA contract. The measured comparison and adoption decision are in [`M4_BACKEND_COMPARISON.md`](M4_BACKEND_COMPARISON.md). It remains optional and outside default dependencies/CI.
- The local update-cost benchmark remains synthetic, but the runner supports repeated samples and reports per-sample timings plus median/range/p90. Results are descriptive and not a stable speed claim. The repair timer collects future human repair sessions without recording slide text; no genuine user repair session has yet been measured.
- A local Google OAuth PKCE test page is implemented for identity and Slides `presentations.readonly`, including read-only metadata access for a presentation ID the user enters. It requires a user-supplied Desktop OAuth client and real account consent has not yet been performed. Google Slides deck creation/edit/sync and Canva adapters are not included; they require separate user authorization and account/API configuration.

## M4 current completion boundary

- Delivered locally: offline PDF/DOCX source extraction with optional OCR, source hashes and locators, the synthetic first-build/one-row-update benchmark, a fixed blind-rating collection workflow, and an evidence-backed comparison of the native PPTX route with an open-source editable-PPTX exporter.
- Ecosystem review: official capability and developer docs for Google Slides, Canva, Gamma, Beautiful.ai, Figma Slides, Microsoft PowerPoint/Copilot, Napkin, Quarto, Slidev and Marp were checked and mapped to adapter decisions in [`M4_ECOSYSTEM_REVIEW.md`](M4_ECOSYSTEM_REVIEW.md).
- Reused an Apache-2.0 licensed Mozilla library in the local PDF source pipeline to remove Poppler as a hard dependency for text import. Its offline import path is covered by a synthetic CLI integration test; it does not perform OCR or scientific verification.
- Still not measured or implemented: genuine human repair-time observations, human blinded ratings, and fully data-editable native chart parity on alternate backends. Scientific source verification remains a human decision supported by claim/source review records, not automatic fact checking. Cloud deck creation/edit/sync and real provider authorization are deferred under the user's instruction; these are not represented as completed or tested.

## Follow-on benchmark and authorization test additions

- The local update benchmark accepts `--samples 1..20`; one five-sample synthetic run is recorded in [`M4_UPDATE_BENCHMARK.md`](M4_UPDATE_BENCHMARK.md) and its raw JSON. It validates every sample's chart/workbook values and native error bars. The measured median update time was 1,599.84 ms (range 1,556.26–1,985.25 ms) on this Windows workstation; this remains synthetic, local, and load-sensitive.
- `npm run benchmark:repair` records a user's actual edit interval and edit count with deck hashes only. The tool is implemented, but no real human repair session has been run, so no repair-time result is claimed.
- The Google OAuth test uses a loopback listener and PKCE with identity-only or Slides read-only access. Unit tests mock Google token/userinfo/Slides endpoints; the environment has no OAuth client file, so no real login or provider request was attempted.

## Canva local login tranche (2026-11-12)

- Added `npm run connect:canva`, a loopback-only Canva user authorization flow using PKCE and only the `profile:read` scope. It reads the current account's display name as a login check; it does not access designs, create/export content, upload files, or persist tokens.
- Configure a Canva public/private app with the `profile:read` permission and redirect URL `http://127.0.0.1:53682/callback`, then set `CANVA_CLIENT_ID` and `CANVA_CLIENT_SECRET` in the local shell. Details are in README.
- Canva auth and profile service were mocked: login/PKCE/profile and state-mismatch tests passed. No credentials are configured here, so real Canva consent remains unverified.
- Canva user authorization is an access check only. Canva design CRUD/export and data-to-slide integration remain unimplemented; this work does not complete M4.

## Offline M4 capability completion tranche

- Added an explicit offline scanned-PDF OCR fallback to the local source importer: Poppler `pdftoppm` rasterizes pages locally and Tesseract performs local OCR. `--ocr tesseract --ocr-lang eng` is opt-in; language data and both executables must already be installed. Page locators, method/language, and `verified:false` status are preserved. This checkout lacks Tesseract, so orchestration and provenance were tested with an injected local-command stub; actual OCR accuracy/output remains unverified here and requires human comparison to source pages.
- Expanded Presentation IR → Slidev mapping for bar, line, scatter, and CDF charts. The mapper checks finite/aligned values, axes, and CDF monotonicity; emits deterministic SVG visuals, and preserves exact x/y series plus source IDs in lineage. Slidev PPTX remains without native chart objects; exported figures are not data-editable.
- Added `benchmark:blind-review` with randomized A/B labels, a separate condition key, a fixed weighted six-dimension rubric, score validation, blinded summaries, and explicit unblinding. No human scores have been collected; embedded author/style metadata may defeat blinding and is disclosed.
- Existing source verification gates are in `src/validate.mjs`, `src/critic.mjs`, `src/review-draft.mjs`, and `src/evaluate-critic.mjs`: claim excerpts/locators and human reviewer/date are required for verified claim-support records; automated checks do not certify truth. No automatic scientific fact-checker is claimed.
- Tests added for OCR fallback orchestration/provenance, all Slidev chart source-value mapping, and blinded rubric/score workflow. Cloud adapters and real account/API tests remain intentionally deferred by the user's instruction.
- Verification on 2026-11-12: both Canva OAuth tests pass; `npm run connect:canva` starts at `http://127.0.0.1:53682` and reports missing local credentials without contacting Canva; `git diff --check` passes. Full `npm test` currently reports **71/74 passing**. The three failures are pre-existing M3A refresh/research-workflow cases, where current `src/qa.mjs` fails on generated 8- and 10-slide fixtures (it prints counts, then exits 1). This must be fixed before claiming the shared checkout passes.
- Verification superseded on 2026-11-12: `npm run check` completed with exit code 0 after the OCR, Slidev IR, and blind-review additions: **85/85 tests passed**, Critic evaluation and update benchmark passed, and all legacy validate/build/native-chart QA stages completed. The prior 71/74 note above records an intermittent run; its three reported QA failures did not recur, and the investigation remains non-reproducible on the passing suite.
- Local Slidev 53.1.0 `pptx-editable` export was run on `examples/m4/slidev-chart-parity-ir.json`; lineage validation passed for slide S01 and E_SYN_CHART. Structural PPTX QA found one text-editable slide and zero native chart objects, as expected for this backend. The final PDF was rendered to `outputs/m4/slidev-chart-parity/retry/page-1.png` and inspected; the series and labels are present after moving the y-axis label to the top-right of the chart. Export invocation caveats are in [`M4_BACKEND_COMPARISON.md`](M4_BACKEND_COMPARISON.md).
- Final verification superseding prior test counts: `npm run check` completed with exit code 0 on 2026-11-12: **85/85 tests passed**, Critic evaluation passed (24 labeled synthetic claim-review cases; precision/recall/F1 1.0 on those contract fixtures only), one-sample synthetic update benchmark passed (first median 1,646.18 ms; one-row update median 1,640.46 ms), and every configured validation/build/structural-QA stage passed. `npm run validate` and `npm run build` are included in this full command. Legacy source warnings remain visible.
- M4 remains not fully accepted as a research benchmark: OCR has only been checked on synthetic pages, no human repair-time session or blinded rater scores were collected, and Slidev's chart is not a native PowerPoint chart. Cloud authorization and APIs were deliberately not exercised per the user instruction.
- Latest shared-worktree `npm run check` passed 69/69 tests plus critic evaluation, synthetic benchmark/update, validation, native PPTX generation/QA and critique. The test total includes six uncommitted M3A layout/research workflow cases; the OAuth/router and benchmark tests are committed separately. Seven pages of the generated 7-slide keynote preview were visually inspected; the repeated-update fixture's pages were not visually inspected.

## Offline PDF.js integration continuation

- Added the Apache-2.0 `pdfjs-dist@5.4.624` library as an installed, lockfile-pinned runtime dependency. Project minimum Node version is now 20.16, matching the library's published engine constraint.
- PDF import still prefers Poppler `pdftotext -layout` if present, and now automatically falls back to local PDF.js if Poppler is not present. `--pdf-engine pdfjs` forces the bundled path. PDF bytes remain local; no OCR or network access is used.
- PDF.js extracts page text from its positioned text items and preserves page locators, blank pages, byte/text hashes, and the `verified:false` status. Its reading order can differ from visual columns; users should compare the extraction against rendered source pages.
- Targeted document-import suite: **4/4 passed**. The integration test removes Poppler from the child process `PATH`, covering automatic fallback, extracted text/page locator, source hash, `verified:false`, and scanned/image-only rejection.
- `npm run check`: **passed** on the current checkout: **45/45 tests**, critic evaluation, update benchmark, validation, editable PPTX builds, structural QA, dual-deck generation, and critique. The 45-test total includes the independent, uncommitted M3A asset work present in the shared working tree during this run; this M4 change adds one test to the prior baseline.
- `npm run deps`: passed; resolved runtime licenses include `pdfjs-dist@5.4.624 (Apache-2.0)`. The PDF.js fallback is run without network access; the research demo's existing unverified-source and chart-sample-size warnings remain visible.

## Bundled local OCR completion (2026-11-12)

- Replaced the prior external Tesseract executable/model prerequisite with `tesseract.js@7.0.0` (Apache-2.0) and locally bundled `@tesseract.js-data/eng@1.0.0` plus `@tesseract.js-data/chi_sim@1.0.0` (MIT). The engine receives an explicit temporary local `langPath`; no CDN, paid API, or document upload is part of execution. License findings are recorded in [`LICENSE_AUDIT.md`](LICENSE_AUDIT.md).
- `--ocr tesseract --ocr-lang eng|chi_sim|eng+chi_sim` activates the opt-in scanned-PDF route. Poppler `pdftoppm` rasterizes pages locally; Tesseract.js recognizes each page, and the manifest records method, language, locator and page confidence. The evidence ledger remains `verified:false` because confidence does not validate scientific claims.
- Actual local recognition tests use generated synthetic English and Simplified Chinese images. A synthetic image-only PDF also passes the importer CLI end to end with an OCR text assertion and unverified provenance. These tests exercise the packaged engine and actual model files, rather than a mocked recognizer. They do not establish accuracy on real research scans.
- `README.md`, the tool catalog, `RESEARCH_APPLICATION_MATRIX.md` and `M4_ECOSYSTEM_REVIEW.md` now describe the implemented OCR option and its Poppler prerequisite.
- Full project verification was rerun after the OCR catalog and language-model changes with `npm run check`; dependency checks, the expanded test suite, critic/benchmark workflows, validation, PPTX builds and structural QA completed successfully. `npm run catalog:generate` wrote 55 entries, including a pinned `tesseract-js` integration record with package-metadata license status. `git diff --check` returned no whitespace errors (Git emitted only LF/CRLF normalization notices).

## Local M4 completion follow-on (2026-11-12)

- Removed the remaining adapter placeholder: `pptxgenjsAdapter.run()` now invokes the validated IR renderer. The registry describes the actual end-to-end route, and workflow recommendations no longer say the unified adapter is pending.
- Added `image` to the shared Presentation IR contract and PptxGenJS mapping. Positions are checked against the 16:9 canvas; local assets must resolve inside the workspace, match their declared media type and SHA-256, and stay under 25 MB. External/data URIs are not fetched, symlink escapes are rejected, and SVGs with script/event/external-reference patterns are rejected.
- Asset ID, source ID, content hash, media type, license text, rights state, slide placement, and alt description are preserved in lineage/run inputs. `restricted` assets are blocked; `pending` or `unknown` rights stay unapproved and generate warnings. Alt text is retained in the slide speaker notes.
- Cloud/API provider authorization, real-world OCR accuracy sign-off, scientific-source approval, blind human scores, repair-time measurements, and visual sign-off require people or account access and remain skipped by instruction. Automated local acceptance does not claim those as completed.
- Targeted checks: `node --test tests/presentation-ir.test.mjs tests/tool-registry.test.mjs` passed 20/20 before image work; `node --test tests/presentation-ir.test.mjs` passed 9/9 after image work. The full `npm run check` is being rerun on the final local state.
