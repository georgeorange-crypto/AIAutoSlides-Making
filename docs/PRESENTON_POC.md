# Presenton backend POC — partial, generation blocked

## Result

Presenton v0.9.12-beta was pulled and started locally from the official GHCR image. The API became reachable, initial local administrator setup and login worked, an ephemeral one-day API key was created, and the documented presentation-generation endpoint accepted the request far enough to invoke the configured Ollama provider. **No PPTX or PDF was generated.** Presenton returned HTTP 404 because the configured `qwen2.5:1.5b` model was not present in Ollama.

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
| Artifacts | No Presenton PPTX/PDF/PNG exists; generation did not complete |
| Data boundary | Synthetic prompt only; image generation disabled; no private input or paid provider |

The temporary Presenton container, named Docker volume, generated administrator credential, and ephemeral API key were removed after recording these results. No credential or auth database is included in this repository.

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

If the complete generation flow passes later, integrate Presenton as an optional local or separately managed **HTTP service**, not by vendoring its source. Keep scientific source IDs, evidence state, exact numbers, provenance sidecars, and post-generation object QA in AIAutoSlides. Treat provider/model, image services, API key management, telemetry settings, and data-transfer boundaries as explicit runtime configuration. Current evidence only supports container installation, startup, and auth/API wiring; it does not support recommending Presenton as the primary design backend yet.
