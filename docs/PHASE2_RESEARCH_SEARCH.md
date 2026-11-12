# Phase 2 research search slice

Status: **metadata search slice implemented and exercised against mocks and one small real query per provider; full Phase 2 remains in progress**.

## What is available

`node src/research-search.mjs` queries OpenAlex, Crossref, or arXiv for a small number of bibliographic candidates. Network access is disabled unless `--allow-network` is present. Each result records the submitted query, provider, retrieval time, request URL, response SHA-256, record SHA-256, provider identifier, and `verification_status: unverified`. Abstract text is not copied into records. Results are written as a new file; existing output files are never overwritten.

```powershell
node src/research-search.mjs --provider openalex --query "retrieval augmented generation evaluation" --limit 5 --out outputs/research/rag-search.json --allow-network
node src/research-search.mjs --provider crossref --query "retrieval augmented generation evaluation" --limit 5 --out outputs/research/rag-crossref.json --allow-network
node src/research-search.mjs --provider arxiv --query "retrieval augmented generation evaluation" --limit 5 --out outputs/research/rag-arxiv.json --allow-network
```

The query is sent to the selected provider only when the explicit flag is supplied. `OPENALEX_API_KEY` is optional and sent in an authorization header; it is not persisted in the request URL or result. Crossref and arXiv need no credentials in this implementation. Each call is bounded to 10 results, a 2 MiB response and a 30-second timeout.

## Separation and evidence boundary

This command only retrieves metadata. It does not download PDFs, scrape pages, use result summaries as quotations, create page-level evidence, verify claims, or grant reuse rights. Full-text retrieval remains a separate future command requiring explicit source and download policy. For local PDF/DOCX extraction, use `npm run import:document -- --help`; the local importer records SHA-256, page/paragraph locators, and extraction status, but the human must verify excerpts against the source.

OpenAlex search follows its works search endpoint and supports optional API-key authentication. arXiv uses the Atom query API, bounded result count, and rejects DTD/entity declarations in responses. Crossref's REST API is queried for bibliographic fields only. Provider policies and rate limits can change; keep calls small and use provider guidance. This implementation does not run bulk harvesting.

## Not complete in Phase 2

- Real network smoke requests and provider-specific failure-rate evidence.
- DOI/paper downloading, source-byte storage for remote records, landing-page crawling, and page-located excerpts.
- PDF embedded-image extraction and DOCX header/footer image extraction; optional Docling and MarkItDown adapters and comparative extraction QA.
- Crawl4AI integration and website terms/robots enforcement.
- Licensed image search/download providers and asset rights workflow.
- Crossref bibliographic search is supported by this module and returns DOI/landing-page metadata when the provider has it. This operation does not resolve a DOI into full text or create evidence.

## Verification commands

The adapter uses injected Fetch implementations in unit tests, so automated tests do not access the network. CLI tests verify network-off by default and refuse-to-overwrite behavior. `npm run test` passed **139/139**. `npm run validate` passed with the three existing warnings (chart sample size and E1/E2 unverified); isolated PPTX build/OOXML QA passed; PowerPoint 16.0 and Poppler rendered seven pages, all seven inspected. Cover title extends slightly into the decorative right panel; this existing demo layout issue is recorded and was not edited in this research slice.

One bounded real query per provider used only the generic public phrase `large language models`, at limit 2; no local research files were sent and no full text was downloaded. Artifacts are in `outputs/phase2-verification/` (`openalex.json`, `crossref.json`, `arxiv.json`). Each produced 2 records, all unverified. Response SHA-256 values: OpenAlex `3b9bdb72dd7d14a5c34e8b02e759b1152a9bccf36ceb3003cf6b5835ee1fe244`; Crossref `a1ee77411b1d8fe13aa36b73454437d912406ef48100922cbaa360fcc2722bff`; arXiv `9609443ae9be515421da7e2ce0016e1a745ee9dbaaf96c460feb8be29cd6a673`. These are connectivity/shape checks, not relevance or scientific-quality evaluations. Do not mark a result verified solely because it is indexed by a scholarly provider.
