# M26 — Explicit local PDF OCR in the project API

Date: 2026-11-12

## Delivered

- Added `--enable-local-pdf-ocr` to the local API CLI. OCR remains disabled by default; `--pdf-ocr-lang` selects bundled `eng`, `chi_sim` or `eng+chi_sim` data.
- Only imported PDF files without selectable text enter OCR. Processing uses the content-addressed local blob and the repository's existing local PDF rasterizer/Tesseract path; no source bytes are uploaded.
- OCR results use distinct `ocr_match` and `ocr_no_match` states, with the source SHA-256, page locator and page confidence. Exact byte/extracted-text checks continue to use `exact_match`/`no_exact_match`.
- OCR matching never changes the evidence's pending state or the source's unverified state. PDF/DOCX extraction caching remains bounded to eight local source hashes.

## Verification

- `node --test tests/api.test.mjs`: PASS (7/7), including OCR disabled by default, explicit enabled-state injection, separate OCR match/no-match statuses, confidence/page locator, and unchanged pending/unverified state.
- `node --test tests/api.test.mjs tests/mcp.test.mjs tests/document-import.test.mjs`: PASS (24/24).
- `node --test --test-concurrency=1`: PASS (176/176). The default parallel test run hit transient local `ECONNRESET` and a 120-second timeout in existing API/OCR tests while multiple CPU-heavy fixtures ran; serial execution passed those same tests.
- `npm run check`: PASS through final critique output, including the 176-test suite, dependency check, benchmark, import/validation, builds and QA.
- `npm run api -- --help`: PASS; invalid `--pdf-ocr-lang` was rejected with the documented allowed choices.
- Existing document-import regression exercises real offline English and Simplified Chinese Tesseract recognition. The new API regression injects a deterministic local OCR result to test API policy and status wiring without rerunning OCR models for the API integration case.
- Synthetic deck build, PDF/PNG render and ten-page visual inspection are recorded in the M24 report; M26 changes API OCR wiring and documentation but not slide generation.

## Limits

- CLI OCR enabling is an operator-level opt-in, not per-request user consent. The loopback API remains single-user and has no authentication.
- OCR is bounded by existing page/response limits but can consume significant CPU and may misrecognize text. Confidence is a recognizer metric, not a probability of correctness.
- OCR text is not verbatim source evidence. A human must compare a match with the original page before recording a review decision; semantic entailment remains outside the service.
