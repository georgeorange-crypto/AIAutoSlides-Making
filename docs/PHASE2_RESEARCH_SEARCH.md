# Phase 2 — research, documents, web pages and licensed assets

Status: **implemented and locally exercised** for the bounded workflows described here. This is an engineering integration status; it does not mean the collected material is scientifically verified or cleared for reuse.

## Workflows

| Workflow | Entry point | Default boundary | Provenance output |
|---|---|---|---|
| Scholarly metadata search | `src/research-search.mjs` | Network off; `--allow-network`; max 10 results | Provider, query, URL, retrieval time, response and record SHA-256; unverified records |
| Project-scoped scholarly search | `POST /projects/{project_id}/research/topic` or MCP `aiautoslides_research_topic` | Requires `allow_network: true`; query is sent to the selected public metadata provider; max 10 results | Normalized metadata candidate bytes are saved under `source-blobs/<sha256>` and attached to project `source_ir.sources` with separate normalized-record and provider-record hashes, provider/query/retrieval time, record ID, title/authors/year/DOI/URL and `unverified` state; same-ID/same-record repeats are idempotent |
| Local Docling extraction | `src/research-ingest.mjs extract --engine docling`; durable API/MCP document job (`engine:"docling"`) | Local files only; model downloads disabled unless `--allow-model-download` or `allow_model_download:true` is separately authorized | Source/text SHA-256, engine/version, page/element locator, short excerpt candidates; durable job status and three artifacts through API/MCP |
| Local MarkItDown extraction | `src/research-ingest.mjs extract --engine markitdown`; durable API/MCP document job (`engine:"markitdown"`) | Optional isolated adapter; local files only; durable job is cancellable | Source/text SHA-256, engine/version, paragraph locator (no page coordinates), short excerpt candidates |
| One-page Crawl4AI | `src/research-ingest.mjs crawl` | Requires `--allow-network --site-authorized`; HTTPS, public DNS by default, same-host requests, robots check, no link traversal or media | Requested/final URL, retrieval time, robots result, extracted Markdown hash, short unverified excerpts |
| Durable one-page Crawl4AI | `POST /projects/{id}/research/pages`; MCP `aiautoslides_enqueue_page_crawl` | Requires `allow_network:true` and operator assertion `site_authorized:true`; one HTTPS page, public DNS by default, same-host redirect/request policy, robots confirmation, 10 MiB Markdown limit | Durable job events/status, content-addressed Markdown, manifest and evidence JSON artifacts, pending unverified excerpts |
| One selected arXiv PDF | `src/research-ingest.mjs download-arxiv`; durable local API/MCP job | Search result ID plus `--allow-download` or API/MCP `allow_download:true`; one PDF, 50 MiB cap, HTTPS host allowlist and PDF signature check | PDF SHA-256, download/landing URLs, page locators and pending unverified excerpts; durable job stages and four artifacts |
| Imported local PDF/DOCX | CLI document importer; durable local API/MCP job | Selected immutable source blob plus API/MCP `allow_extract:true`; local-only, PDF.js selectable text or DOCX body paragraphs | Source/text hashes, page/paragraph locators and pending excerpts; durable job status and three artifacts |
| Wikimedia Commons image | `src/asset-research.mjs`; durable API/MCP selected-asset job | Search requires `--allow-network`; separately select one result and pass `--allow-download` or API/MCP `allow_network:true` plus `allow_download:true`; one PNG/JPEG image | Source page, image URL/hash, author, license/terms metadata, project IR asset/source records and `needs_human_review` rights state |

All output writers refuse to overwrite an existing output. Extracted source text and webpages are untrusted data. Generated excerpts are candidates only; `verified` remains false until a human checks them against the source. A license string in an API response is metadata to review, not approval to use an image.

The local API route `POST /projects/{id}/research/papers` accepts a selected arXiv candidate source ID only when `allow_download:true`; MCP clients can enqueue the same operation with `aiautoslides_enqueue_arxiv_ingest`. The durable job stores the original PDF by content hash, locally parses page text, attaches excerpt candidates with page locators and pending verification, and records the PDF, Markdown, manifest and evidence JSON as artifacts. It does not verify scientific claims or grant reuse rights.

An imported PDF/DOCX can be extracted through `POST /projects/{id}/research/documents` or MCP `aiautoslides_enqueue_document_ingest`. The default PDF.js/DOCX path is offline. The optional `engine:"docling"` path runs the pinned Docling worker asynchronously against the verified immutable source blob; model downloads are disabled unless a separate `allow_model_download:true` opt-in is supplied. The `engine:"markitdown"` option uses the optional local MarkItDown 0.1.9 worker asynchronously and supports cancellation; it preserves only document-level paragraph locators. PDF.js returns selectable-text page locators, the DOCX parser returns paragraph locators, and Docling preserves available page/element provenance. The job attaches excerpts as pending evidence and emits extracted Markdown, manifest and evidence JSON. PDF.js does not perform OCR for scanned PDFs; none of these paths verifies scientific claims.

An explicitly authorized single page can be queued through `POST /projects/{id}/research/pages` or MCP `aiautoslides_enqueue_page_crawl`. Both explicit booleans are required. The durable worker performs HTTPS/DNS validation before and after the crawl, rejects cross-host redirects, and requires Crawl4AI's robots-policy result. It stores page Markdown by SHA-256 and records pending excerpt evidence plus a manifest. Authorization and reuse rights are not inferred from robots access; the operator must review site terms and rights before using content. Automated tests inject a synthetic worker and do not contact the page.

## Installation

Use Python 3.12. The installer creates an isolated `.venv/research`, installs the pinned `workers/research/requirements-lock.txt`, and installs the matching local Playwright Chromium required by Crawl4AI. It does not configure a hosted AI service. On Windows:

```powershell
./workers/research/install.ps1
```

For a non-default runtime, set `AIAUTOSLIDES_PYTHON` to its Python executable. `node src/research-ingest.mjs doctor` reports installed Docling and Crawl4AI versions. Docling model files are an additional download: extraction is offline by default and requires the explicit `--allow-model-download` flag when they are not already cached. MarkItDown retains its separate user-owned environment and installer (`npm run deps:markitdown`).

## Commands

```powershell
node src/research-search.mjs --provider openalex --query "large language models" --limit 2 --out outputs/research/openalex.json --allow-network
node src/research-search.mjs --provider crossref --query "large language models" --limit 2 --out outputs/research/crossref.json --allow-network
node src/research-search.mjs --provider arxiv --query "large language models" --limit 2 --out outputs/research/arxiv.json --allow-network

node src/research-ingest.mjs doctor
node src/research-ingest.mjs extract --engine docling --input paper.pdf --id E_PAPER --out-prefix outputs/research/paper
node src/research-ingest.mjs extract --engine markitdown --input report.docx --id E_REPORT --out-prefix outputs/research/report
node src/research-ingest.mjs crawl --url https://example.org/page --site-authorized --allow-network --out-dir outputs/research/site-page
node src/research-ingest.mjs download-arxiv --results outputs/research/arxiv.json --source-id SRC_ARXIV_SELECTED --allow-download --out-dir outputs/research/paper-pdf

node src/asset-research.mjs search --query "scientific instrument" --limit 3 --out outputs/research/commons.json --allow-network
node src/asset-research.mjs download --results outputs/research/commons.json --candidate-id WMC_SELECTED --asset-id A_INSTRUMENT --out-dir outputs/research/instrument --allow-download
```

The `--site-authorized` flag is an operator assertion, not an automated terms check. Crawl4AI checks robots policy, limits the run to one page, and blocks cross-origin and image/media/font requests. Public IP validation rejects private and reserved addresses. Environments with an explicitly documented outbound gateway that maps DNS to a special range may set `AIAUTOSLIDES_EGRESS_CIDRS` for that exact range; the mapping is recorded in the crawl manifest. Do not add a range just to bypass a failed safety check.

## Implementation and verification evidence

- Pinned local runtime: Docling 2.150.0 and Crawl4AI 0.9.5. MarkItDown 0.1.9 remains an optional isolated local runtime.
- `node src/research-ingest.mjs doctor` returned both research packages available in the isolated Python 3.12 environment.
- Synthetic local PDF extraction ran through Docling and MarkItDown; each produced Markdown, a source manifest and short excerpt candidates, with review pending.
- The durable local document job supports opt-in Docling through REST/MCP while keeping PDF.js (selectable text) as the default for PDF and the built-in paragraph extractor as the DOCX default. Model download consent is separate. In an offline CLI smoke using the existing Docling 2.150.0 runtime, the generated seven-page demo PDF produced 30 page/element blocks; source/text hashes and pending review state were recorded. The API route's durable job behavior is covered with an injected worker fixture.
- OpenAlex, Crossref and arXiv each completed one bounded limit-2 public metadata query. Those connectivity checks are not relevance or scientific-quality evaluations.
- One selected arXiv PDF was downloaded and parsed into 17 page-located unverified excerpt candidates. Paper-specific reuse rights remain pending.
- One Wikimedia Commons result was downloaded as a JPEG after an explicit separate selection. The manifest records its declared CC0 metadata, creator and source/license links, SHA-256 `a66390173bfec5c0ffcbe2e567597ba97518205305050e221ff1709f96bdba36`, and still requires human rights review.
- One explicitly authorized `https://example.com` page was crawled through Crawl4AI after provisioning Playwright Chromium. It was a single-page connectivity check, not a content-quality or policy compliance audit.
- Reproducible local artifacts are under `outputs/phase2-verification/` (gitignored): provider query JSON, extraction bundles, the selected arXiv PDF bundle, Commons search/download records, and the crawl manifest.

Final checks on the latest remote revision: `npm run test` passed **157/157**; `npm run validate`, `npm run build`, and `npm run preview` exited 0; OOXML QA reported 7 editable slides and 1 native chart. PowerPoint 16.0 and Poppler 26.07.0 rendered the seven-page deck, and all seven images were inspected. The sample-size warning and two unverified evidence entries remain. The latest cover title wraps within the content column and does not intrude into the decorative panel. Every factual slide must still use known evidence IDs from `sources/evidence.json`; this integration creates candidate evidence records and does not auto-merge them or mark them verified.

## Deliberate limits

- Crossref, OpenAlex and arXiv in this slice provide bibliographic search, not general DOI full-text resolution. Only the selected arXiv result has a bounded PDF downloader.
- Crawl4AI does not follow links, bypass access controls, or fetch page media. Bulk media retrieval is not implemented.
- Wikimedia Commons is the only integrated asset source. The license/creator/attribution metadata is retained, but every downloaded asset remains blocked for slide reuse until a human checks the file page and intended use.
- MinerU is not integrated because the blueprint requires a separate review of its additional license conditions and model terms.
- Parser accuracy, scientific claims, excerpt correctness, media rights and website terms require human review. No measured accuracy or benchmark claim is made.
