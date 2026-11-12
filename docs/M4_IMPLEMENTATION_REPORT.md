# Milestone 4 — Local source import, first tranche

**Status:** Offline `.docx` extraction and selectable-text `.pdf` extraction are implemented behind `src/import-document.mjs`. PDF.js (`pdfjs-dist`, Apache-2.0) is integrated as a bundled local fallback when Poppler is absent; Poppler remains the preferred backend when installed for layout-preserving text extraction. Import artifacts preserve local-source hashes, extracted-text hashes, paragraph/page locators, and an explicitly unverified evidence entry. No cloud upload, OCR, paid service, or external API is used.

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

- OCR is intentionally out of scope; scanned documents must be processed separately and the output manually checked.
- This adapter extracts text and provenance; it does not automatically create claims, slides, or verify claim-to-source entailment.
- An optional open-source export backend was evaluated on a three-slide synthetic fixture. Slidev `pptx-editable` preserved editable text with no raster pictures in this case, but rendered with weaker theme/layout fidelity and did not provide the project's evidence lineage or chart QA contract. The measured comparison and adoption decision are in [`M4_BACKEND_COMPARISON.md`](M4_BACKEND_COMPARISON.md). It remains optional and outside default dependencies/CI.
- The local update-cost benchmark remains one synthetic run, not a stable speed claim. Human-measured repair-time protocol and repeated samples remain future work.
- Google Slides/Canva adapters and PowerPoint/Google sync are not included; they require separate user authorization and account/API configuration.

## M4 current completion boundary

- Delivered locally: offline PDF/DOCX source extraction, source hashes and locators, the synthetic first-build/one-row-update benchmark, and an evidence-backed comparison of the native PPTX route with one open-source editable-PPTX exporter.
- Ecosystem review: official capability and developer docs for Google Slides, Canva, Gamma, Beautiful.ai, Figma Slides, Microsoft PowerPoint/Copilot, Napkin, Quarto, Slidev and Marp were checked and mapped to adapter decisions in [`M4_ECOSYSTEM_REVIEW.md`](M4_ECOSYSTEM_REVIEW.md).
- Reused an Apache-2.0 licensed Mozilla library in the local PDF source pipeline to remove Poppler as a hard dependency for text import. Its offline import path is covered by a synthetic CLI integration test; it does not perform OCR or scientific verification.
- Not delivered: cloud sync/authenticated account adapters, OCR, scientific source verification, chart parity for alternate backends, repeated timing distributions, or manual repair-time measurement. These are not represented as completed.

## Offline PDF.js integration continuation

- Added the Apache-2.0 `pdfjs-dist@5.4.624` library as an installed, lockfile-pinned runtime dependency. Project minimum Node version is now 20.16, matching the library's published engine constraint.
- PDF import still prefers Poppler `pdftotext -layout` if present, and now automatically falls back to local PDF.js if Poppler is not present. `--pdf-engine pdfjs` forces the bundled path. PDF bytes remain local; no OCR or network access is used.
- PDF.js extracts page text from its positioned text items and preserves page locators, blank pages, byte/text hashes, and the `verified:false` status. Its reading order can differ from visual columns; users should compare the extraction against rendered source pages.
- Targeted document-import suite: **4/4 passed**. The integration test removes Poppler from the child process `PATH`, covering automatic fallback, extracted text/page locator, source hash, `verified:false`, and scanned/image-only rejection.
- `npm run check`: **passed** on the current checkout: **45/45 tests**, critic evaluation, update benchmark, validation, editable PPTX builds, structural QA, dual-deck generation, and critique. The 45-test total includes the independent, uncommitted M3A asset work present in the shared working tree during this run; this M4 change adds one test to the prior baseline.
- `npm run deps`: passed; resolved runtime licenses include `pdfjs-dist@5.4.624 (Apache-2.0)`. The PDF.js fallback is run without network access; the research demo's existing unverified-source and chart-sample-size warnings remain visible.
