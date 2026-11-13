# Project-scoped scholarly research candidates

Status: **implemented as an explicit search, review-list, and selected-source registration flow**.

Project-scoped `POST /projects/{id}/research/search` requires `allow_network:true`, searches OpenAlex/Crossref/arXiv through the existing bounded adapter, and saves result metadata in the local workspace SQLite database. `GET /projects/{id}/research/candidates` lists saved candidates and import status. `POST /projects/{id}/research/candidates/{source_id}/import` registers only the selected saved candidate under the project's `source_ir.sources`. The equivalent project search, list and import actions are available through stdio MCP.

Imported source records keep the provider record ID, title, authors, year, DOI, landing/record URLs, search query, retrieval time, and response SHA-256. They remain `verification_status:"unverified"` and `evidence_status:"metadata_candidate_only"`. The flow does not create evidence excerpts or claims, fetch papers, or verify metadata. Repeat imports are idempotent; an unknown candidate is rejected. Metadata is retained as untrusted provider data, and its hash establishes byte identity only.

## Verification

- Focused API/MCP tests: **8/8 passed** after adding project candidate persistence and import coverage; mocked provider responses only.
- Full `npm test`: **173/173 passed** on the rerun. The first full-suite attempt had one existing local API workflow test fail with a transient `ECONNRESET` under load (172/173); the isolated rerun and the later full check both passed.
- `npm run check`, including `npm run validate`, `npm run build`, critic evaluation, synthetic chart builds and QA, completed successfully. Existing research-demo warnings remain: two unverified evidence records and a missing chart sample size.
- `npm run preview` rendered the seven-slide research demo with PowerPoint 16.0 and Poppler 26.07.0. Every PNG was opened; no apparent clipping or chart overflow was found. Human scientific/design sign-off remains pending.
- No live provider request or paid API was called.

## Limits

- Candidate search history is a bounded list of provider results, not a full-text or citation manager.
- The user must still inspect provider records and source documents, select factual excerpts and locators, and create/review claim mappings before building a scientific deck.
- Generic DOI resolution, full-text parsing, automatic evidence extraction, and scientific verification remain incomplete.
