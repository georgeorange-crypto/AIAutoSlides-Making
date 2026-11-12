# Phase 2 Slice — Local MarkItDown Import

## Delivered

- Added an optional, isolated Python 3.12 worker pinned to MarkItDown 0.1.9 with only the PDF, DOCX, PPTX, and XLSX extras. The dependency input and resolved package lock are kept under `workers/markitdown/`; setup is opt-in through `npm run deps:markitdown`.
- Added `packages/adapters/markitdown.mjs`, a `tools doctor/test` entry, and `npm run import:markitdown`. Input must be a local regular file under an explicitly supplied allowed root, no larger than 50 MiB, with an allowlisted extension. The adapter checks the resolved path before starting the worker, bounds conversion time/output, and validates the returned source hash.
- The worker calls MarkItDown's narrow `convert_local()` API with plugins disabled. It does not accept URLs, download files, request hosted OCR/captioning, or call paid cloud services. Output is a Markdown source record with a document-level locator, source SHA-256 and `verification_status: unverified`.
- Example: `npm run import:markitdown -- --input D:/research/incoming/paper.pdf --allowed-root D:/research/incoming --out outputs/paper-markdown.json`. The selected root must already exist and contain the source file; an existing output is rejected.
- Unsupported claims are deliberately excluded: conversion does not preserve exact page layout or page coordinates and does not verify factual text. The subprocess runs with the current user's OS permissions; it is process-separated, not a security sandbox.

## Verification

- `npm run deps:markitdown`: installed MarkItDown 0.1.9 into the optional worker virtual environment. System Python 3.10 could not initialize due to an invalid global `.pth` encoding; Python 3.12 succeeded.
- `npm run tools -- tools doctor markitdown`: available (0.1.9).
- `npm run tools -- tools test markitdown`: local HTML smoke passed; worker reported `network: not-requested`.
- `node --test tests/markitdown-adapter.test.mjs tests/tool-registry.test.mjs`: 18/18 adapter and catalog tests passed.
- The synthetic local PDF fixture converted end to end. The record contains 234 Markdown characters, source SHA-256 `2a897f02e2790456c896b01f532568e7e9c2704ab24afccb83a41f9cb8538dd3`, one document-level locator and unverified status. It preserves the fixture's explicit “No experiment was run” statement.
- Full repository check: `npm run test` passed 143/143; `npm run validate` passed the 7-slide example with the existing three warnings; `npm run build` created a 7-slide PPTX; `npm run preview` rendered seven pages with PowerPoint 16.0 and Poppler, then each page was inspected. The demo cover title extends slightly into its decorative right panel; this pre-existing visual issue remains outside the parser slice.

## Limits and source notes

The official project recommends `convert_local()` for local-only input and warns that conversion runs with the caller's privileges; this adapter follows the narrow API and adds explicit path, size and process limits. Only requested local office/PDF extras are installed; Azure, OCR/captioning and other hosted extras are omitted. The lock was resolved on Windows with CPython 3.12; Linux/macOS worker installation still needs validation. MarkItDown is a text-oriented fallback and should not replace PDF.js/Tesseract where page locators or scan OCR are required.

Upstream references: [MarkItDown usage and security guidance](https://github.com/microsoft/markitdown#readme), [MarkItDown package metadata](https://github.com/microsoft/markitdown/blob/main/packages/markitdown/pyproject.toml), [pinned 0.1.9 release](https://pypi.org/project/markitdown/0.1.9/).
