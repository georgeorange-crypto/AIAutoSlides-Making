# Presenton backend POC — local mock API generation passed; model quality untested

## Result

### Local OpenAI-compatible mock run (2026-11-12)

After the initial Ollama model-download blocker below, a second run exercised the complete Presenton API and renderer through its documented custom OpenAI-compatible provider mode. No model was deployed: a local Node mock returned schema-conforming synthetic JSON over streamed SSE. The same synthetic nine-slide fixture generated a PPTX and Presenton-exported PDF (HTTP 200). This validates service/API integration and export only; it is not model inference, authored content, or evidence of real-model design quality.

Reproduce from the repository root (Docker image must already be pulled or pullable):

```powershell
node scripts/run-presenton-mock-poc.mjs outputs/open-source-bakeoff/presenton-mock-poc-20261112
```

The harness starts the official pinned container on an ephemeral loopback port, provisions a fresh temporary app-data directory and short-lived local API key, points `LLM=custom` at its own ephemeral mock endpoint, disables image generation, web search, Mem0 and anonymous tracking, exports PPTX and PDF, runs AIAutoSlides structural QA, writes a JSON report, and removes the container, credentials and app data. It makes no hosted model or paid API call. The mock accepts only `/v1/models` and `/v1/chat/completions`; other requests return 404 and are counted. Fixture outputs are ignored under `outputs/`.

Verified clean rerun artifact directory: `outputs/open-source-bakeoff/presenton-mock-poc-20261112-final3/` (local ignored output; JSON report, QA JSON/Markdown, and nine PNGs rendered from PDF at 110 DPI). SHA values below are from this completed rerun.

| Artifact / check | Evidence |
|---|---|
| API calls | 10 streamed chat completions: one layout response and nine slide responses; generation HTTP 200 and PDF export HTTP 200. |
| PPTX | 272,026 bytes; SHA-256 `3fa85c3f4bce1b3727a932dcfd07501e4a04249ef8c4084fcd9aa3321cca09e8`. |
| PDF | 133,093 bytes; SHA-256 `ea712bf8acb9b078ba042c8145ec4ab801f15d7012ff9fd666857991759c77cb`. |
| Object QA | 9/9 slides with editable text; 18 native shapes; 0 connectors, native charts or native tables; 45 picture objects (5 per slide); structural overlap detector reported 0 overlap pairs per slide. |
| Visual review | 9/9 PDF page renders inspected. **This mock fixture fails visual acceptance:** repeated layout/background and placeholder attribution card; long titles are clipped/truncated on pages 1–7 and 9; page 2 and page 9 body content collides with/gets obscured by the card. Text contrast is readable. |

The structural overlap detector did not catch the visible clipping/card collisions. The deck is intentionally mechanical: mock values are schema-filled and layout index 0 is selected repeatedly. Therefore visual failures describe this fixture and renderer output under mock responses, not a real model's generation quality. Keep the per-page PNGs local for review; no generated deck or third-party template is committed.

### Per-page visual QA

| Page | Review result |
|---|---|
| 1 | Title clips at “Synthetic local-first pre”; generic attribution card is repeated. |
| 2 | Title clips at “Design the pipeline aroun”; body text runs into the attribution card. |
| 3 | Title clips at “Separate evidence from pr”; repeated background and attribution card. |
| 4 | Title clips at “Keep figures determini”; body and card remain separated. |
| 5 | Title clips at “Layout intent should surv”; repeated background and attribution card. |
| 6 | Title clips at “Track limitations as stru”; repeated background and attribution card. |
| 7 | Title clips at “Compare capabilities, not”; repeated background and attribution card. |
| 8 | Title fits; repeated background and generic attribution card remain. |
| 9 | Title wraps/clips at “Recommendation for this t”; body text runs into the attribution card and is obscured. |

### Initial Ollama attempt

Presenton v0.9.12-beta was pulled and started locally from the official GHCR image. The API became reachable, initial local administrator setup and login worked, an ephemeral one-day API key was created, and the documented presentation-generation endpoint invoked Ollama. That first run returned HTTP 404 because the configured `qwen2.5:1.5b` model was not present. The later local mock run above completed PPTX/PDF export.

The Ollama model pull was attempted twice. Its server log reports that redirected Cloudflare R2 model blobs resolve to `198.18.3.57`, a non-public address, and refuses those redirects. `ollama list` remained empty. This is an environment/network blocker, not a successful local-model inference. No paid or remote LLM API was called. Image generation and anonymous tracking were disabled; the request contained only a synthetic/hypothetical nine-slide brief.

## Tested configuration and evidence

| Item | Value |
|---|---|
| Official image | `ghcr.io/presenton/presenton:v0.9.12-beta` |
| Image digest | `sha256:dd444e4384df0caeb7cb96a26bfa7543a12d2be19c83d661446b2087d09aed54` |
| Upstream tag commit | `93b9dcf947f70ae107b779b51dd3c491e736748a` |
| License | Apache-2.0, per the upstream project |
| Container host | Docker Desktop Linux engine 29.9.3, local-only bind `127.0.0.1:5001` |
| Runtime env | `LLM=ollama`, `OLLAMA_URL=http://host.docker.internal:11434`, `OLLAMA_MODEL=qwen2.5:1.5b`, `DISABLE_IMAGE_GENERATION=true`, `DISABLE_ANONYMOUS_TRACKING=true` |
| API evidence | `GET /api/v1/auth/status` returned 200; local setup/login succeeded; local API-key creation succeeded; POST `/api/v1/ppt/presentation/generate` reached the provider and returned 404 `model 'qwen2.5:1.5b' not found` |
| Model state | Ollama `api/tags` returned an empty model list after attempted pull |
| Artifacts | Ollama attempt: no output. Local mock attempt: PPTX/PDF plus nine inspected PNGs (ignored local outputs; hashes above). |
| Data boundary | Synthetic prompt only; image generation disabled; no private input or paid provider |

The temporary Presenton containers, app-data directories, generated administrator credentials, and ephemeral API keys were removed after recording these results. No credential or auth database is included in this repository.

## Reproduction and current blocker

```powershell
docker pull ghcr.io/presenton/presenton:v0.9.12-beta
docker run -d --name presenton-poc `
  -p 127.0.0.1:5001:80 `
  -e LLM=ollama `
  -e OLLAMA_URL=http://host.docker.internal:11434 `
  -e OLLAMA_MODEL=qwen2.5:1.5b `
  -e DISABLE_IMAGE_GENERATION=true `
  -e DISABLE_ANONYMOUS_TRACKING=true `
  -v presenton-poc-data:/app_data `
  ghcr.io/presenton/presenton:v0.9.12-beta
```

With a working Ollama registry/blob route, pull the model and confirm `GET http://localhost:11434/api/tags` lists it before creating the local account, generating an API key, and posting the fixed request. The local request attempted `/api/v1/ppt/presentation/generate` with nine supplied Markdown slides and `export_as=pptx`. It must be rerun after the network path allows Ollama's signed blob redirects to reach public addresses.

## Integration recommendation

Integrate Presenton, if desired, as an optional separately managed **HTTP service** through its API, not by vendoring its source. The mock POC proves a service adapter can reach generation/export without deploying a model. Keep scientific source IDs, evidence state, exact numbers, provenance sidecars, and post-generation object and visual QA in AIAutoSlides. Treat provider/model, image services, API key management, telemetry settings, and data-transfer boundaries as explicit runtime configuration. Do not recommend Presenton as primary until a permitted real provider or local model produces content whose visual quality and scientific fidelity pass review.
