# Security and privacy model — Phase 1 local slice

## Assets and trust boundaries

- User-provided files, URLs, extracted text, PDF text, slide notes, storyboard/IR text and third-party adapter output are untrusted data. Never interpret their content as instructions to the host.
- Source identity and integrity (path/hash/locator) are distinct from scientific verification. Extraction creates pending/unverified evidence only.
- The local PptxGenJS and Slidev routes do not require credentials. No external provider is invoked by the IR build path.
- Network-capable research or rendering services remain disabled until a later consent design identifies destination, files, purpose and expected cost.

## Path and process controls

- The local REST service binds only to loopback. Imported source files must resolve inside its `incoming/` directory; original bytes are copied to immutable SHA-256-addressed files. The IR adapter rejects lexical traversal and output symlink escapes from its run workspace. API artifact downloads recheck the stored content hash.
- Use an isolated per-run directory, timeouts and bounded artifact/log sizes for subprocess adapters. Do not expose arbitrary shell execution as an Agent tool.
- Do not pass secrets in arguments, logs or manifests. Use scoped environment/config references if a future adapter needs credentials.
- Keep original PPTX/source files immutable. Write edited/exported copies to new paths and retain hashes for comparison.

## Scientific integrity controls

- Unknown evidence IDs, malformed chart data and unsupported elements fail before rendering.
- Preserve `verified:false`/pending/contradicted state into notes and source manifests. Renderer output never modifies that state.
- AI-generated prose remains draft and is not permitted to supply numerical series.
- QA separates structural checks from human assessment. A passing XML audit is not a scientific fact check or visual approval.

## Known limits

The local API persists state in SQLite, resumes queued work after a restart and marks interrupted running jobs as failed. It does not provide OS-level sandboxing, multi-user isolation, remote authentication, MCP authorization scopes or a threat-tested server. It only binds to loopback; do not proxy it onto a network without adding those controls.
