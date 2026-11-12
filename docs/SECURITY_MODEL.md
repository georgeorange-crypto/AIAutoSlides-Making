# Security and privacy model — Phase 1 local multi-principal slice

## Assets and trust boundaries

- User-provided files, URLs, extracted text, PDF text, slide notes, storyboard/IR text and third-party adapter output are untrusted data. Never interpret their content as instructions to the host.
- Source identity and integrity (path/hash/locator) are distinct from scientific verification. Extraction creates pending/unverified evidence only.
- The default local API principal is `local`; an embedding host may supply a trusted `authenticate(request)` callback. The callback must verify a real credential and return a stable non-`local` `user_id`; the API does not itself implement OIDC, password login or token issuance.
- Project list/read/edit, job status/cancel and artifact access are owner-scoped when the callback is enabled. IR/source blobs are stored in a user-specific namespace; project/job/artifact rows remain in one SQLite database.
- The local PptxGenJS and Slidev routes do not require external credentials. No external provider is invoked by the IR build path.
- Network-capable research or rendering services remain disabled until a later consent design identifies destination, files, purpose and expected cost.

## Path and process controls

- The REST service still binds only to loopback. In default local mode, path-based source imports must resolve inside `incoming/`; authenticated mode uses the bounded binary `source-files` upload route and rejects caller-supplied server paths. Uploaded originals are copied to immutable SHA-256-addressed user namespaces. The IR adapter rejects lexical traversal and output symlink escapes from its run workspace. API artifact downloads recheck the stored content hash.
- Each Job stores the SHA-256 and immutable path of its submitted IR revision. Later project edits do not change the queued Job input. Each Job writes under its unique `runs/<job_id>/` directory.
- The in-process scheduler bounds active jobs globally and per user and rotates the next eligible owner; this is single-process coordination, not a distributed lease.
- Use an isolated per-run directory, timeouts and bounded artifact/log sizes for subprocess adapters. Do not expose arbitrary shell execution as an Agent tool.
- Do not pass secrets in arguments, logs or manifests. Use scoped environment/config references if a future adapter needs credentials.
- Keep original PPTX/source files immutable. Write edited/exported copies to new paths and retain hashes for comparison.

## Scientific integrity controls

- Unknown evidence IDs, malformed chart data and unsupported elements fail before rendering.
- Preserve `verified:false`/pending/contradicted state into notes and source manifests. Renderer output never modifies that state.
- AI-generated prose remains draft and is not permitted to supply numerical series.
- QA separates structural checks from human assessment. A passing XML audit is not a scientific fact check or visual approval.

## Known limits

The API has additive owner-scoping and per-user blob namespaces when an embedding host supplies a trusted authenticator. It still has no built-in identity provider, project sharing/roles, OS-level worker sandbox, remote bind, MCP authorization scopes, multi-process queue coordination or threat-tested server. SQLite and files are managed by one service account. Do not proxy the API onto a network without a real authentication integration, TLS, upload limits/quotas, worker isolation and a security review. Authenticated mode's initial scope is project-owner isolation; it is not a complete hostile-tenant sandbox.
