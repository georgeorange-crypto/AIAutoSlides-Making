# Phase 2 Slice — Crossref DOI Metadata

## Delivered

- Added a no-key, GET-only Crossref DOI lookup adapter, catalog entry, tool doctor/smoke registration and a `research` recommendation stage.
- DOI names and DOI URLs normalize to one canonical DOI. The adapter limits each response to 2 MiB, uses a 10-second default timeout, rejects redirects, serializes requests, caches results in memory for 30 seconds and reports 404/429/403 failures explicitly.
- Output is a selected bibliographic source record with canonical DOI URL, authors, venue, dates, publisher-provided license links, update notices, retrieval timestamp and SHA-256 of the raw response. It deliberately excludes abstracts and full text. All returned records remain `unverified`; no evidence excerpts or scientific claims are synthesized.
- `CROSSREF_MAILTO` is optional; no credentials or email are required. Unit and registry smoke tests use a mock and make no external calls.

## Verification

- Mocked adapter tests pass for DOI normalization, selected fields, no-abstract behavior, source hash, cache, invalid identifiers, oversized/mismatched responses and HTTP failures.
- One live, read-only lookup was made for Crossref's documented example DOI `10.1128/mbio.01735-25`. It returned a title and 12 authors; the adapter retained status `unverified`, excluded abstract text, and recorded response hash `6b24c13a74a711468c67792c3cc6215339a4cb7671d8b3a28eb7583492b897b4`.

## Limits

The adapter performs DOI lookup only. It does not search by topic, retrieve full text, create source evidence, establish reuse rights, detect every post-publication concern, or verify claims. Crossref records are deposited by members and can be incomplete or stale. Abstracts can carry copyright, so this adapter does not persist them.
