# Local REST/MCP scholarly metadata search

Status: **implemented as an explicit opt-in metadata search action**.

`POST /research/search` routes through the existing metadata search adapter for OpenAlex, Crossref, or arXiv. It rejects requests unless `allow_network:true` is present, validates provider/query/limit at the API boundary, and returns the adapter's bounded result records. `aiautoslides_research_search` exposes the same operation through stdio MCP with `openWorldHint:true` and a required network opt-in argument.

The operation sends the search query to the selected public provider. It does not download articles, create project evidence records, establish that metadata is correct, verify claims, or call an AI model. Results retain `verification_status:unverified` and `evidence_status:metadata_candidate_only`. The REST API remains loopback-only and unauthenticated for one local user.

## Verification

- Focused API, MCP, and metadata adapter tests: **12/12 passed** with injected/mock search results; no live provider request was made.
- Full `npm test`: **171/171 passed**. `npm run check`, `npm run validate`, and `npm run build` completed successfully.
- `npm run preview` rendered the existing seven-page research demo using PowerPoint 16.0 and Poppler 26.07.0. All seven PNGs were opened; no apparent clipping or chart overflow was found. Machine warnings remain for two unverified evidence records and a chart without `sample_size`; human scientific/design sign-off remains pending.

## Limits

- This is metadata search only. Generic DOI resolution, full-text acquisition, project evidence insertion, human review workflows, and scientific verification remain separate or incomplete capabilities.
- MCP tool approval behavior depends on the host client; the tool explicitly advertises its external-service effect and requires `allow_network:true`.
