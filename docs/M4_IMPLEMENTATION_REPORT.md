# Milestone 4 — Local source import, first tranche

**Status:** Offline `.docx` extraction and selectable-text `.pdf` extraction are implemented behind `src/import-document.mjs`. Import artifacts preserve local-source hashes, extracted-text hashes, paragraph/page locators, and an explicitly unverified evidence entry. No cloud upload, OCR, paid service, or external API is used.

## Delivered

- `npm run import:document -- --input <file.pdf|file.docx> --id E_LOCAL_SOURCE [--evidence ledger.json] [--out-prefix outputs/imports/source]` writes quoted extracted text (`.md`), an evidence ledger (`.evidence.json`), and extraction manifest (`.manifest.json`). Existing ledgers are copied and appended in the output; inputs are not modified.
- DOCX paragraphs and table-cell paragraphs are extracted in document order using the existing `fflate` dependency. Paragraph numbering is retained as a locator. Headers/footers, comments, tracked-deletion semantics, and OCR of embedded images are not extracted; complex table layout is linearized.
- PDF selectable text is extracted with locally installed Poppler `pdftotext -layout`; form-feed page boundaries and blank-page numbering are retained. Image-only/scanned PDFs fail with a clear OCR-not-performed message.
- Source and normalized-extraction SHA-256 values are recorded. Imported evidence is always `verified:false`; generated Markdown quotes source text and marks it as untrusted data, not instructions.
- Tests create a synthetic DOCX and exercise CLI import → evidence ledger → storyboard validation/build. PDF page parsing, blank-page locators and no-text rejection are covered; a real local Poppler integration test runs when Poppler exists and skips otherwise.

## Verification

- `npm test`: **40/40 passed**, including end-to-end synthetic DOCX import → evidence ledger → storyboard/PPTX build and an actual local selectable-text PDF import (Poppler present on this workstation).
- `npm run check`: passed, including all importer tests, M1/M2 generation and QA, dual-deck build, and offline Slide Critic evaluation. Existing unverified/synthetic evidence warnings remain visible.
- `npm run import:document -- --help`: passed. Negative unsupported-format invocation returned nonzero with `Supported local formats are .pdf and .docx`.
- `npm run preview`: rendered the existing 7-slide keynote demo to PDF and seven PNG files; each page was manually inspected. No visual changes were introduced by the local source adapter.
- DOCX integration test confirms the evidence record is `verified:false`, source hash matches the exact source bytes, paragraphs/table-cell text retain order/locators, and the linked storyboard builds to PPTX.
- PDF integration test confirms Poppler extracted selectable text from a generated synthetic one-page PDF. The parser unit tests retain blank page locators and reject image-only/no-text input with the OCR limitation.
- `git diff --check`: passed; Git emitted only line-ending normalization notices.

## Scope limits / next M4 work

- OCR is intentionally out of scope; scanned documents must be processed separately and the output manually checked.
- This adapter extracts text and provenance; it does not automatically create claims, slides, or verify claim-to-source entailment.
- Next: add a repeatable deck update/repair benchmark using measured timings already supported by `src/refresh-runs.mjs`, and compare export fidelity/editability for an optional open-source backend before implementing external sync adapters.
- Google Slides/Canva adapters and PowerPoint/Google sync are not included; they require separate user authorization and account/API configuration.
