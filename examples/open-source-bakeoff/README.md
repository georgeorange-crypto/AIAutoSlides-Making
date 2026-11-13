# Open-source backend bake-off POC inputs

All material is synthetic/hypothetical. The one numeric table (120/240/360 req/s) is fixture input, not a measured result. The shared talk source is [`synthetic-systems-talk.md`](synthetic-systems-talk.md), with an unverified evidence record in [`synthetic-evidence.json`](synthetic-evidence.json). Each slide maps to `E_SYN_01` and uses stable slide IDs `S01`–`S09` in speaker notes. The Presenton request fixes the same nine narrative beats and numbers.

## Slidev (completed local rendering POC)

The verified local package installation is already in ignored `outputs/m4/slidev-lab` from the earlier M4 test: `@slidev/cli@53.1.0`, `@slidev/theme-default@0.25.0`, `playwright-chromium@1.65.0`; Google Chrome `C:\Program Files\Google\Chrome\Application\chrome.exe`; Node `v24.14.0`. No model/provider or network content was used during export.

```powershell
npm install --prefix outputs/m4/slidev-lab --no-save --ignore-scripts --no-audit --no-fund @slidev/cli@53.1.0 playwright-chromium@1.65.0 @slidev/theme-default
& .\outputs\m4\slidev-lab\node_modules\.bin\slidev.cmd export .\examples\open-source-bakeoff\synthetic-systems-talk.md --format pptx-editable --output outputs/open-source-bakeoff/slidev-systems-talk.pptx --with-clicks false --executable-path 'C:\Program Files\Google\Chrome\Application\chrome.exe'
& .\outputs\m4\slidev-lab\node_modules\.bin\slidev.cmd export .\examples\open-source-bakeoff\synthetic-systems-talk.md --format pdf --output outputs/open-source-bakeoff/slidev-systems-talk.pdf --executable-path 'C:\Program Files\Google\Chrome\Application\chrome.exe'
& .\outputs\m4\slidev-lab\node_modules\.bin\slidev.cmd export .\examples\open-source-bakeoff\synthetic-systems-talk.md --format png --output outputs/open-source-bakeoff/slidev-png --executable-path 'C:\Program Files\Google\Chrome\Application\chrome.exe'
node .\src\qa.mjs outputs/open-source-bakeoff/slidev-systems-talk.pptx
```

Outputs and manual visual review are documented in [`../../docs/BACKEND_BAKEOFF.md`](../../docs/BACKEND_BAKEOFF.md).

## Presenton

The API/export loop was completed locally with a deterministic mock OpenAI-compatible endpoint, not a deployed model. The stub sends schema-shaped responses from the synthetic slide text; it does not assess real model inference or content quality. See [`../../docs/PRESENTON_POC.md`](../../docs/PRESENTON_POC.md) for version, exact configuration, Pptx object counts, reproduction, and all-page visual QA. PPTX/PDF/PNG outputs stay in ignored `outputs/open-source-bakeoff/presenton-mock/` and are not committed.

```powershell
node .\examples\open-source-bakeoff\presenton-mock-api.mjs # terminal A
docker run -d --name presenton-mock-poc -p 127.0.0.1:5001:80 `
  -e LLM=custom -e CUSTOM_LLM_URL=http://host.docker.internal:8008/v1 `
  -e CUSTOM_LLM_API_KEY=mock-local-only -e CUSTOM_MODEL=synthetic-mock-v1 `
  -e DISABLE_IMAGE_GENERATION=true -e DISABLE_ANONYMOUS_TRACKING=true `
  -v presenton-mock-poc-data:/app_data ghcr.io/presenton/presenton:v0.9.12-beta
# Create an ephemeral local user/key, then keep the key only in process memory.
$env:PRESENTON_API_KEY = '<temporary local API key>'
./examples/open-source-bakeoff/run-presenton.ps1
docker rm -f presenton-mock-poc
docker volume rm presenton-mock-poc-data
```

No hosted/paid API or private source file was used. Never commit generated decks/previews or local keys.

## PPTAgent

Current upstream Skill checkout and `pptagent-task.json` are used for an offline/manual authoring attempt. Upstream supports a fixed task folder with nine HTML slides, local rendering/review and editable PPTX export. The generation Skill itself can use the host coding agent; a model-based visual-review configuration may make an external API call. No such call was made.

The official workflow requires Linux/WSL or macOS, Python 3.11+, uv, npm and LibreOffice. This Windows environment lacked LibreOffice and WSL could not start; the native Windows dependency installation also stopped at `fasttext==0.9.3` requiring Microsoft C++ Build Tools. See the exact failure record in `BACKEND_BAKEOFF.md`.
