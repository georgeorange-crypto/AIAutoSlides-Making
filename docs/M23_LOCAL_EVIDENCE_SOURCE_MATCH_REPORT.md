# M23 — Verbatim matching against imported local text sources

Date: 2026-11-12

## Delivered

- Evidence create/list/review responses compute a `source_match` from immutable, locally imported source bytes.
- Exact checking supports UTF-8 `.txt`, `.md`, `.markdown`, `.csv`, `.json`, `.yaml`, `.yml`, `.xml`, `.html`, `.htm` and `.log` files up to 20 MiB. Exact matches report the source SHA-256, count and first UTF-16 code-unit offset.
- Non-matches are labeled `no_exact_match`; no bytes, unsupported formats, oversized files and invalid UTF-8 produce `unavailable` with a reason.
- Every new excerpt remains `pending`, every imported source remains `unverified`, and no source or claim verification is inferred from a text match.
- MCP descriptions and README/API/schema/capability docs explain the boundary.

## Verification

- `node --test tests/api.test.mjs tests/mcp.test.mjs`: PASS (10 tests, 0 failures). New regression covers exact match, no verbatim match, unimported-source unavailability, binary PDF unavailability, hash/offset/count, and unchanged pending/unverified states.
- `npm test`: PASS (175/175). An earlier run had one transient `ECONNRESET` to `www.canva.com`; the isolated Canva test then passed 2/2 and full suite passed on retry.
- `npm run check`: completed through the final critique stage; all 175 tests passed along with critic evaluation, benchmark update, Markdown/CSV validation, builds and QA.
- Synthetic 10-slide acceptance PPTX rebuilt; PowerPoint 16.0 and Poppler 26.07.0 rendered a 10-page PDF and ten PNGs. QA: 10 slides, all text-editable, one native chart; expected unverified synthetic evidence warnings remain.
- All ten PNGs were opened and visually reviewed. No page clipping or major overlap was visible. Project-owner visual sign-off remains pending.

## Limitations

- A verbatim match only proves that the excerpt string occurs in the imported bytes identified by the hash. It does not prove source authenticity, truth, context, or claim entailment.
- PDF/DOCX extracted-text alignment, OCR output, normalization differences and semantic matching are not covered. Such sources return unavailable unless a supported text file is separately imported.
- Files larger than 20 MiB and non-UTF-8 text are not searched.
