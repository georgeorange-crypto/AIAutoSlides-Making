# Pending source evidence excerpts

Status: **implemented as a user-supplied excerpt registration route**.

`POST /projects/{id}/evidence` accepts a stable evidence ID (up to 128 characters), an existing project source ID, excerpt text up to 10,000 characters, and an optional locator up to 1,000 characters. It preserves the excerpt string and records it in `source_ir.evidence[]` with `verification_status:"pending"`, `reviewer:null`, and `reviewed_at:null`. Any client-supplied verification status is ignored. Unknown sources, duplicate evidence/source IDs, malformed IDs, whitespace-only excerpts, and overlong fields are rejected. `GET /projects/{id}/evidence` returns the project ledger entries. MCP exposes matching list/add tools.

The excerpt is submitted by the user; the API does not read or re-fetch the source, compare excerpt text to source bytes, assess whether an excerpt entails a claim, or verify the source. The parent source stays unchanged. Pending evidence cannot be treated as scientifically verified.

## Verification

- Focused REST/MCP tests: **9/9 passed**, including a request that attempts `verification_status:"verified"`; the stored result remains pending.
- Full `npm test`: **174/174 passed**. `npm run check` completed, including validation, build, synthetic chart builds, critic evaluation and structural QA.
- `npm run preview` rendered the seven-slide research demo with PowerPoint 16.0 and Poppler 26.07.0; each page was opened and reviewed. No apparent clipping or chart overflow was found. Two unverified evidence warnings and one missing chart sample-size warning remain in the demo; human scientific/design sign-off is pending.
- No external or paid API request was made for this stage.

## Limits

- There is no API workflow to approve/contradict excerpts or bind a reviewer identity and content hash; use the existing local review workflow for human approval.
- This endpoint does not create claim records or assert evidence entailment.
