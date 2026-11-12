# Phase 4 slice — local MCP server

Date: 2026-11-12 · Scope: expose the existing local project API to MCP hosts over stdio.

## Delivered

- Implemented newline-delimited JSON-RPC MCP over stdio, modern discovery/per-request metadata for protocol `2026-07-28`, and legacy initialization support for the 2025 protocol family.
- Added 11 stable tools for health, project lifecycle, slide listing/patching, source import, render enqueue/status/cancel and artifact metadata.
- MCP only calls the already-running local REST API. API URL validation rejects remote hosts, non-HTTP URLs, credentials, paths, queries and fragments. The underlying API retains loopback binding and its incoming-directory source boundary.
- Tool schemas reject unknown arguments and validate IDs/field shapes. Writes are explicitly described as requiring host-mediated user approval. Source verification is not upgraded.
- Added `npm run mcp`, Codex/Claude Code configuration examples, request/frame/output size limits, stderr-only logs, and offline protocol/integration tests.

## Verification

| Check | Result |
|---|---|
| Source syntax | Passed: `node --check src/mcp.mjs`. |
| MCP tests | Passed: 3/3, including loopback rejection, current/legacy version negotiation and stdio MCP → project creation → render job → PPTX artifact metadata. |
| Full project check | Passed: `npm run check` exited 0; 139/139 tests passed, followed by importer, validation, build, QA, repeated-run and dual-edition checks. Expected warnings for unverified demo evidence remain visible. |
| API command help | Passed: `node packages/api/cli.mjs --help`. |
| External services | None called. Tests used a local API and local PptxGenJS workflow. |

## Limits

The server implements stdio, not Streamable HTTP. It trusts the MCP host to provide approval UI for mutations; tool descriptions alone cannot enforce that UI. The local REST API is single-user and unauthenticated, and must not be exposed through a reverse proxy. MCP uses no web search, source retrieval or model API.

Protocol references: [stdio transport](https://modelcontextprotocol.io/specification/draft/basic/transports/stdio), [tools](https://modelcontextprotocol.io/specification/draft/server/tools), [discovery](https://modelcontextprotocol.io/specification/draft/server/discover), [version compatibility](https://modelcontextprotocol.io/specification/draft/basic/versioning).
