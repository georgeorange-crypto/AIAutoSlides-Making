# Phase 2 — Wikimedia Commons asset workflow

Status: **implemented as a bounded, opt-in search and single-image import path; license and attribution decisions remain human work**.

## Workflow

Search returns a small list of Wikimedia Commons file candidates and rights metadata. It does not download image bytes. A user then selects one `source_id`, supplies an asset ID, and explicitly opts into downloading that image. PNG/JPEG bytes are content-hashed and stored beside an `assets.json` manifest compatible with the existing asset loader.

```powershell
npm run assets:research -- search --query "scientific instrument" --limit 5 --out outputs/assets/instruments.json --allow-network
npm run assets:research -- download --results outputs/assets/instruments.json --candidate-id WMC_... --asset-id A_INSTRUMENT --out-dir outputs/assets/instrument-1 --allow-download
```

Each downloaded asset is marked `verified: false` and `rights_review_status: needs_human_review`. The manifest retains the provider's license label and URL, author, credit, attribution flag, source page, download URL, metadata hash, retrieval time and image hash. Check the file description page and applicable license terms before placing an asset in a deck; provider metadata is a lead, not a rights determination.

## Boundaries

- Network search requires `--allow-network`; downloading requires a separate `--allow-download` flag.
- Search is limited to 10 results and a 4 MiB response. Individual image downloads are limited to 25 MiB.
- Downloads accept only HTTPS from Wikimedia upload/thumbnail hosts, refuse redirects, and require PNG/JPEG file signatures. SVG, arbitrary URLs, bulk downloads and overwrite of output files are rejected.
- Requests have a 20-second timeout. Results retain SHA-256 provenance and remain unverified.
- This path does not grant image reuse rights, verify attribution accuracy, or perform a full license audit.

## Verification

- Focused Wikimedia Commons and arXiv/metadata tests: run with `node --test tests/wikimedia-commons.test.mjs tests/arxiv-download.test.mjs tests/metadata-search.test.mjs`.
- Test coverage includes candidate rights fields and response hash, one-item PNG download and hash, compatibility with the asset manifest loader, refusal of arbitrary hosts/invalid IDs/non-image bytes, and CLI default-off checks for search and download.
- No real provider request or media download is required for the automated test suite; tests use injected Fetch implementations.

## Next work

Complete source-specific license review and add an explicit human approval record before asset insertion into a presentation. Extend the workflow to other providers only after separate terms, attribution and download-policy review.
