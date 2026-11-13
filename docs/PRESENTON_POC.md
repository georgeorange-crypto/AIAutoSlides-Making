# Presenton POC — deterministic mock API loop

**Run:** 2026-11-12 (local), UTC request logs 2026-11-13. **Scope:** exercise the official Presenton API, its layout and slide-content pipeline, PPTX export, PDF render, and package inspection without deploying a model or calling a hosted/paid API. This is a renderer/API integration pass, **not** an LLM inference or content-quality test.

## Result

**End-to-end API/export pass with a deterministic local mock; visual and scientific-backend fit fail for production promotion.** Presenton v0.9.12-beta accepted the authenticated nine-slide request, made one structured layout-selection call and nine per-slide structured-content calls to the local OpenAI-compatible stub, and returned a PPTX path. The artifact was copied from the self-hosted container, opened/exported to PDF by locally installed PowerPoint, and all nine PDF pages were rendered to PNG and inspected.

The deterministic stub supplies schema-shaped strings from the synthetic input. It does not run a language model and its replies do not establish quality, reasoning, or scientific correctness. No external model/image/search service was called. Only the marked synthetic/hypothetical fixture was sent to the local Presenton service and local mock.

## Reproduced setup and configuration

| Item | Observed value |
|---|---|
| Upstream | [Presenton v0.9.12-beta source](https://github.com/presenton/presenton/tree/93b9dcf947f70ae107b779b51dd3c491e736748a), tag `v0.9.12-beta`, commit `93b9dcf947f70ae107b779b51dd3c491e736748a`; [official API/provider README](https://github.com/presenton/presenton/blob/93b9dcf947f70ae107b779b51dd3c491e736748a/README.md) |
| Image | `ghcr.io/presenton/presenton:v0.9.12-beta`, digest `sha256:dd444e4384df0caeb7cb96a26bfa7543a12d2be19c83d661446b2087d09aed54` |
| License | Apache-2.0 for the Presenton project. Container/transitive component notices were not exhaustively inventoried. |
| Host | Windows 11, PowerShell, Docker Desktop Linux engine 29.9.3; Node `v24.14.0`; installed Microsoft PowerPoint; Poppler `pdfinfo`/`pdftoppm` |
| Local API config | `LLM=custom`; `CUSTOM_LLM_URL=http://host.docker.internal:8008/v1`; `CUSTOM_LLM_API_KEY=mock-local-only`; `CUSTOM_MODEL=synthetic-mock-v1`; image generation and anonymous tracking disabled |
| Calls | Presenton auth/setup/login/API-key flow succeeded; generation returned `presentation_id=2feed1ac-b0c8-4fe7-b3c9-e81291e76511`; mock received 10 streamed `POST /v1/chat/completions` calls: 1 layout structure + 9 slide content |
| External API/cost | None. The mock is the only configured model-compatible endpoint. No model weights were installed. |
| Local artifacts | PPTX 380,401 bytes, SHA-256 `3CCE45F32F9D3D4B8A0A98264A0E0504AF085F72832FDD8D65140FCFA14808F1`; PDF 302,207 bytes, SHA-256 `7F716CA9A4F889D5B35BDBDC26E20AB9D2C4BF9F92D6C13F712E9D700360175A`; nine page PNGs. |

The deterministic test server is [`presenton-mock-api.mjs`](../examples/open-source-bakeoff/presenton-mock-api.mjs). It implements authenticated OpenAI-compatible JSON-schema Chat Completions with SSE streaming, responds from the supplied synthetic slide text, and logs request metadata only. The input is [`presenton-request.json`](../examples/open-source-bakeoff/presenton-request.json); the unchanged AIAutoSlides fixture ledger marks `E_SYN_01` unverified and its values as synthetic.

## Failed attempts and boundaries

- The preceding local-Ollama attempt remains a failed real-model setup: Presenton returned `model not found` because no model was installed; Ollama logs showed the model blob redirect resolving to `198.18.3.57`, which Ollama rejected as non-public. Per the user's direction, this phase did not retry or deploy a model and used the local mock instead.
- During mock development, the first request failed while the test process stopped, then initial mock responses failed Presenton's streaming/JSON-schema validation. The final server handles SSE, nullable schema alternatives and `minItems`; the successful generation produced 10 completed calls. These were mock compatibility defects, not Presenton export failures.
- PowerPoint rejected the COM request to hide its window (`Visible=0`), but `Presentation.SaveAs(..., 32)` completed and the resulting PDF had nine pages. This POC only claims the successful PDF/export/render steps.

## Reproduction

From the repository root in PowerShell, start the mock server in terminal A and leave it running:

```powershell
node .\examples\open-source-bakeoff\presenton-mock-api.mjs
```

In terminal B start Presenton with local-only ports and a disposable volume:

```powershell
docker run -d --name presenton-mock-poc `
  -p 127.0.0.1:5001:80 `
  -e LLM=custom `
  -e CUSTOM_LLM_URL=http://host.docker.internal:8008/v1 `
  -e CUSTOM_LLM_API_KEY=mock-local-only `
  -e CUSTOM_MODEL=synthetic-mock-v1 `
  -e DISABLE_IMAGE_GENERATION=true `
  -e DISABLE_ANONYMOUS_TRACKING=true `
  -v presenton-mock-poc-data:/app_data `
  ghcr.io/presenton/presenton:v0.9.12-beta
```

Wait for `GET http://127.0.0.1:5001/api/v1/auth/status` to return 200. The following creates an ephemeral local administrator and one-day API key in memory, submits the fixed synthetic request, and copies the resulting PPTX from the container. The generated credentials and key are never written to a file:

```powershell
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$username = 'poc-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$password = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(24))
$credentials = @{ username = $username; password = $password } | ConvertTo-Json -Compress
$null = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:5001/api/v1/auth/setup' `
  -WebSession $session -ContentType 'application/json' -Body $credentials
$null = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:5001/api/v1/auth/login' `
  -WebSession $session -ContentType 'application/json' -Body $credentials
$status = Invoke-RestMethod -Uri 'http://127.0.0.1:5001/api/v1/auth/status' -WebSession $session
$keyBody = @{ user_id = $status.user_id; label = 'temporary synthetic POC'; expiry_days = 1 } | ConvertTo-Json -Compress
$key = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:5001/api/v1/admin/api-keys' `
  -WebSession $session -ContentType 'application/json' -Body $keyBody
$env:PRESENTON_API_KEY = $key.token
try {
  $result = ./examples/open-source-bakeoff/run-presenton.ps1
  New-Item -ItemType Directory -Path outputs/open-source-bakeoff/presenton-mock -Force | Out-Null
  docker cp "presenton-mock-poc:$($result.path)" outputs/open-source-bakeoff/presenton-mock/presenton-synthetic.pptx
} finally {
  Remove-Item Env:\PRESENTON_API_KEY -ErrorAction SilentlyContinue
  Remove-Variable key,credentials,password -ErrorAction SilentlyContinue
}
```

With the PPTX copied to the ignored output folder, run the object checks:

```powershell
node src/qa.mjs outputs/open-source-bakeoff/presenton-mock/presenton-synthetic.pptx
py examples/open-source-bakeoff/inspect-presenton-pptx.py outputs/open-source-bakeoff/presenton-mock/presenton-synthetic.pptx
```

For this run, PowerPoint exported the PPTX to PDF with `SaveAs(..., 32)` and Poppler rendered all pages:

```powershell
$ppt = (Resolve-Path 'outputs/open-source-bakeoff/presenton-mock/presenton-synthetic.pptx').Path
$app = New-Object -ComObject PowerPoint.Application
$deck = $app.Presentations.Open($ppt, $true, $false, $false)
$deck.SaveAs((Join-Path (Split-Path $ppt) 'presenton-synthetic.pdf'), 32)
$deck.Close(); $app.Quit()
pdftoppm -png -r 110 outputs/open-source-bakeoff/presenton-mock/presenton-synthetic.pdf outputs/open-source-bakeoff/presenton-mock/page
```

Stop the mock process with Ctrl+C; remove the local service and its disposable database after preserving the desired local evidence:

```powershell
docker rm -f presenton-mock-poc
docker volume rm presenton-mock-poc-data
```

## Object-level editability

[`runtime-object-report.json`](../artifacts/open-source-bakeoff/presenton/runtime-object-report.json) is produced by parsing the PPTX Open XML package. The local binary/PDF/PNGs are deliberately not committed; they remain under ignored `outputs/open-source-bakeoff/presenton-mock/`.

| Measure | Result |
|---|---:|
| Slides / notes pages | 9 / 9 |
| Slides containing editable text | 9 / 9 |
| Native text shapes | 18 (2 per slide) |
| Native PowerPoint shapes | 18 |
| Picture objects | 45 (5 per slide) |
| Native chart objects / tables | 0 / 0 |
| External slide relationships | 0 |
| Evidence IDs in speaker notes | `E_SYN_01` present on all 9 pages |

Presenton's own `src/qa.mjs` inspection reported 9 slides, 9 text-editable slides and 0 native charts. Exact synthetic numeric claims remain in editable body text; this run does not provide a native chart or workbook. The source ID survives verbatim in speaker notes but is split into text runs in visible body rendering, so do not rely on a rendered footer or use Presenton output as the lineage authority.

## Page-by-page visual QA

All nine 16:9 pages (960×540 pt; 110 DPI PNGs) were visually opened and inspected. They have no missing page or off-canvas image. The exported deck is not acceptable for an unattended research presentation: **large titles truncate on 8/9 pages** (page 4 title fits); all nine lower-right title/description cards clip one or more lines, and five repeated picture objects per page dominate a highly repetitive template. Page 8 also has cramped body line spacing. Slides 1, 4 and 7 use the same abstract image; slides 2, 3, 5, 6, 8 and 9 still repeat the same card structure. No evidence is provided that these images are meaningful or licensed figure assets. The local PNGs are the visual review record; the object report preserves extracted text and notes.

| Page | Visible title (as rendered) | Page-specific visual finding |
|---:|---|---|
| 1 | `A hypothetical systems de…` | Large title cuts off; lower-right title/description card clips both lines; repeated abstract image. |
| 2 | `Problem: tools draft and…` | Title ends mid-thought; lower-right card clips; body fits but does not rescue the incomplete heading. |
| 3 | `Source files → evidence l…` | Title is truncated; lower-right card clips; long arrow pipeline body remains readable. |
| 4 | `Synthetic fixture values` | Title/body readable; lower-right card clips; repeated abstract image. |
| 5 | `Assertion: one claim per…` | Title truncates; lower-right card clips. |
| 6 | `Unsupported chart → warni…` | Title truncates after arrow; lower-right card clips. |
| 7 | `Check export via local co…` | Title truncates; lower-right card clips; repeated abstract image. |
| 8 | `Local renderer: repeatabl…` | Title truncates; lower-right card clips; body line spacing is cramped and line shapes nearly touch. |
| 9 | `Keep evidence ledger and…` | Title truncates; lower-right card clips; long body is close to the right edge but stays on canvas. |

**Page review disposition:** 0/9 pages pass presentation-ready visual QA; all 9 need layout changes before a human-facing deck should be used. PNG paths are `outputs/open-source-bakeoff/presenton-mock/page-1.png` … `page-9.png` on this machine; generated preview files are excluded from Git by repository policy.

## Defects, limits, integration recommendation

- Mocking required protocol work discovered in the actual Presenton pipeline: streamed SSE responses, nullable JSON Schema handling, and schema minimum array lengths. The included stub now implements these behaviors; it is test code, not a model emulator.
- Actual HTML/template layout did complete and generated editable text, but truncation and raster image objects show that successful export is not equivalent to slide QA.
- No existing-PPTX import/edit/round-trip was tested in this POC. The generated deck has no native chart objects.
- Integrate only as an optional isolated **HTTP service adapter** with an explicit provider configuration and post-export OOXML + visual QA gate. Preserve evidence ledger, exact chart mappings, and a provenance sidecar in AIAutoSlides; verify a returned PPTX against that sidecar. Do not promote Presenton to primary research backend based on this stubbed test.
- Real model inference, semantic content quality, genuine image generation, arbitrary PPTX editing, transitive image/font/template licenses, and Linux/WSL rendering QA remain unverified.
