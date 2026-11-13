# M24 — Selectable PDF/DOCX evidence excerpt matching

Date: 2026-11-12

## Delivered

- Project evidence create/list/review now compare exact excerpts with selectable PDF page text and DOCX paragraph text using the repository's existing offline PDF.js and DOCX extractors.
- Matches return the immutable source SHA-256, occurrence count, offset within the matched text block, and page/paragraph locator. Text files retain their raw UTF-8 exact-match behavior.
- Malformed/unreadable PDF or DOCX sources and missing blobs return explicit `unavailable` reasons. Extracted PDF/DOCX text is cached in memory (up to eight source hashes) to avoid reparsing it for every excerpt response.
- OCR is not launched by the evidence API. Evidence remains pending and sources remain unverified regardless of the match result.

## Verification

- `node --test tests/api.test.mjs tests/mcp.test.mjs`: PASS (10/10), including selectable synthetic PDF page match, generated synthetic DOCX paragraph match, malformed PDF unavailability, missing-blob unavailability, and pending/unverified state assertions.
- `node --test tests/api.test.mjs tests/mcp.test.mjs tests/document-import.test.mjs`: PASS (23/23), including the existing local PDF/DOCX/OCR extraction coverage.
- `npm test`: PASS (175/175).
- `npm run check`: PASS through final critique output; dependency check, all tests, critic evaluation, benchmark, Markdown/CSV conversions and validations, builds, QA, dual-edition build and critique completed.
- Rebuilt the synthetic 10-slide AI Systems PPTX; PowerPoint 16.0 and Poppler 26.07.0 generated a 10-page PDF and ten PNGs. QA found 10/10 text-editable slides and one native chart, with expected warnings for synthetic unverified evidence.
- Opened and visually inspected all ten PNGs. No clipping or material layout collision was visible. The cover's two decorative circular outlines are empty; this is a minor visual issue and does not affect slide content. Owner visual sign-off remains pending.

## Limits

- PDF.js extraction can reorder or omit complex multi-column, table, glyph-mapped or image-only text. DOCX extraction linearizes content and does not preserve every semantic structure. Matching extracted text is not an assertion that an excerpt is represented faithfully in the original visual context.
- OCR and whitespace/Unicode normalization are not applied by this API check. Compare extracted matches against the original page/document before human evidence review.
- A verbatim source match does not establish source authenticity, licensing, truth, or claim entailment. The reviewer API still records caller-supplied identity without authentication.
