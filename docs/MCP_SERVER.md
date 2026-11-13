# Local AIAutoSlides MCP Server

`npm run mcp` starts an MCP stdio process that exposes the already-running AIAutoSlides local REST API. The MCP process itself does not open a network listener. The REST API must be started separately and remains bound to loopback.

## Start the API

```powershell
npm run api -- --workspace D:\AIAutoSlidesData --port 8787
```

The API needs Node.js 22.5+ for SQLite. Its workspace stores project data, immutable source blobs, generated runs and the SQLite database.

## Configure an MCP client

The default API URL is `http://127.0.0.1:8787`. Set `AIAUTOSLIDES_API_URL` only when using another local port. The URL must use plain HTTP to `127.0.0.1` or `[::1]`, with no user info, path, query or fragment; remote hosts are rejected.

Example Codex `config.toml` entry:

```toml
[mcp_servers.aiautoslides]
command = "node"
args = ["D:/path/to/AIAutoSlides/src/mcp.mjs"]
env = { AIAUTOSLIDES_API_URL = "http://127.0.0.1:8787" }
```

Example Claude Code `.mcp.json` entry:

```json
{
  "mcpServers": {
    "aiautoslides": {
      "command": "node",
      "args": ["D:/path/to/AIAutoSlides/src/mcp.mjs"],
      "env": { "AIAUTOSLIDES_API_URL": "http://127.0.0.1:8787" }
    }
  }
}
```

Replace the example repository path with the real absolute path. Configure the MCP server in client approval mode and require confirmation for project creation, source import, slide edits, render jobs and cancellation.

## Exposed tools

`aiautoslides_enqueue_commons_asset` queues one selected Commons image download. It requires `allow_network:true` and `allow_download:true`, stores the PNG/JPEG and provenance in the project, and leaves license, attribution and reuse rights pending human review. Candidate search metadata is caller-supplied and is treated as unverified.

The server exposes schema-described tools for API health, project listing/creation/reading, local preference profile CRUD, audience-aware planning, deterministic Critic, scholarly metadata search, selected arXiv ingestion, local document extraction, slide listing/editing, incoming-source import, render/research-job enqueue/status/cancel, artifact metadata and PPTX export discovery. Profile tools store preferences locally; creation and update require host approval, while profiles cannot enable network or paid API access. Projects can be created with `profile_id` to apply audience, duration and theme defaults unless the supplied IR already defines them. Language, tone and slide-density preferences appear in the deterministic content plan as authoring guidance; they do not trigger translation or automatic rewriting. `aiautoslides_research_topic` runs a project-scoped metadata search; `aiautoslides_enqueue_research` queues the same opt-in operation as a durable single-stage job. Both send the query to OpenAlex/Crossref/arXiv and persist unverified source candidates without downloading full text or creating evidence excerpts. `aiautoslides_enqueue_arxiv_ingest` queues download and local PDF.js extraction for one selected candidate and requires `allow_download:true`; the PDF is stored by SHA-256 and page excerpts are attached as pending evidence. The paper and excerpts remain unverified and reuse rights remain unreviewed. `aiautoslides_enqueue_document_ingest` extracts a previously imported PDF or DOCX locally with PDF.js, Docling or MarkItDown; it requires `allow_extract:true`, attaches pending excerpts and does not upload source content. Docling model downloads require a separate `allow_model_download:true` opt-in; MarkItDown requires its optional local environment and provides document-level paragraph locators only. Treat search and arXiv download as outbound, project-mutating actions and require user approval. `aiautoslides_export_deck` returns the local artifact download route and SHA-256; the host fetches the bytes through the loopback REST API. Planning and critique are local deterministic checks; Critic never marks facts verified or visual review approved. The API enforces that imported source paths resolve inside its workspace `incoming/` directory. Source text and imported files remain untrusted data.

The server supports modern MCP `2026-07-28` discovery/per-request metadata and legacy initialization for `2025-11-25`, `2025-06-18`, `2025-03-26` and `2024-11-05`. It uses newline-delimited UTF-8 JSON-RPC over stdio, caps inbound frames at 4 MiB, API request payloads at 12 MiB and API responses at 8 MiB, and writes logs only to stderr. It intentionally does not implement Streamable HTTP or authentication.

The MCP host owns the user confirmation interface. Tool descriptions ask for user approval before project/profile creation or updates, outbound research, source import, slide edits, render jobs and cancellation; a server cannot force a host to display a confirmation prompt. Keep the REST API private and loopback-only; do not expose it through a reverse proxy.

`aiautoslides_enqueue_document_ingest` also accepts `engine:"docling"` for asynchronous local PDF/DOCX layout-aware extraction. Docling model downloads remain disabled unless separately authorized with `allow_model_download:true`; that opt-in can download model weights, while the source document remains local. All excerpts remain pending human verification. `aiautoslides_enqueue_page_crawl` queues one page from an operator-authorized public HTTPS URL and requires `allow_network:true` and `site_authorized:true`. DNS/public-address and same-host redirect rules are enforced, Crawl4AI must confirm robots policy, and excerpts remain pending human verification with reuse rights unreviewed. This is an outbound network action and mutates the selected project; the MCP host should request user approval.

The server exposes deterministic, schema-described tools for API health, project listing/creation/reading, slide listing/editing, incoming-source import, evidence excerpt listing/creation/review, render-job enqueue/status/cancel and artifact metadata. Scholarly search tools can query OpenAlex, Crossref or arXiv only when explicitly called with `allow_network:true`; project search saves unverified metadata candidates locally, and a separate tool registers one selected candidate as an unverified source. A caller may submit an exact excerpt and locator, but the API initially records it as pending; a separate human review tool records a caller-supplied verified/contradicted decision bound to the excerpt SHA-256. Later edits to reviewed evidence content return its current state to pending while preserving the old review as stale audit history. The reviewer identity is not authenticated, and neither source status nor claim entailment is verified by the service. No tool downloads full text or calls a model API. The API enforces that imported local-file paths resolve inside its workspace `incoming/` directory. Source text and imported files remain untrusted data.

The server supports modern MCP `2026-07-28` discovery/per-request metadata and legacy initialization for `2025-11-25`, `2025-06-18`, `2025-03-26` and `2024-11-05`. It uses newline-delimited UTF-8 JSON-RPC over stdio, caps inbound frames at 4 MiB, API request payloads at 12 MiB and API responses at 8 MiB, and writes logs only to stderr. It intentionally does not implement Streamable HTTP or authentication.

The MCP host owns the user confirmation interface. Tool descriptions ask for user approval before project writes and explicitly identify external search, but a server cannot force a host to display a confirmation prompt. Keep the REST API private and loopback-only; do not expose it through a reverse proxy.

Protocol references: [MCP stdio transport](https://modelcontextprotocol.io/specification/draft/basic/transports/stdio), [MCP tools](https://modelcontextprotocol.io/specification/draft/server/tools), [MCP discovery](https://modelcontextprotocol.io/specification/draft/server/discover), and [version compatibility](https://modelcontextprotocol.io/specification/draft/basic/versioning).
