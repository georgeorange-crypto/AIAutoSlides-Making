# Phase 2 — Selected arXiv full-text ingestion

Status: **implemented for one explicitly selected paper per run; extracted text and evidence remain pending human review**.

## Workflow

First create an arXiv metadata result file with `npm run research:search`. Then select one `source_id` and run:

```powershell
npm run arxiv:ingest -- download --results outputs/research/arxiv.json --source-id SRC_ARXIV_... --allow-download --out-dir outputs/research/papers/paper-1
```

The command accepts only arXiv search result files, derives a PDF URL from the selected arXiv identifier, follows only the arXiv download allowlist, bounds the PDF to 50 MiB and validates its PDF signature. PDF.js extracts selectable text locally. The new output directory contains the original `source.pdf`, page-located `extracted.md`, a source manifest with byte count and SHA-256, and short page excerpt candidates in `evidence.json`.

Every excerpt is `verified: false` with `pending_human_review`; the manifest records `reuse_rights: needs_review`. Empty/scanned-only PDFs fail with a clear message rather than implying OCR. Human reviewers must compare excerpts to the original page and check the paper-specific reuse terms before using claims or figures.

## Verification

- `node --test tests/arxiv-download.test.mjs tests/arxiv-ingest.test.mjs` covers URL derivation, redirect host checks, malformed IDs, non-PDF responses, size bounds, candidate selection, source hashing, page locators, unverified status, scanned-only failure, overwrite refusal, and CLI opt-in.
- Tests inject downloader and extractor implementations and do not make network requests.
- Existing unrelated demo preview/layout findings are recorded with the overall Phase 2 check; this ingestion step does not change the sample deck.

## Limits and next work

This step handles arXiv only. It does not resolve Crossref/OpenAlex records to full text, query publisher locations, perform OCR, verify scientific claims, or decide reuse rights. Future providers need their own allowlists, opt-in controls, rate limits, and rights review.
