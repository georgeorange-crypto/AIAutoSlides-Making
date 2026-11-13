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

Start the official self-hosted container, create a local user/API key in the UI, then invoke the fixed-content request. The call does not include a model key; the instance must be configured to use an allowed local provider, otherwise generation remains blocked. The generated deck is not in this repo.

```powershell
docker run -d --name presenton-poc -p 5001:80 -v "${PWD}\outputs\open-source-bakeoff\presenton-data:/app_data" ghcr.io/presenton/presenton:v0.9.12-beta
$env:PRESENTON_API_KEY = '<local instance API key>'
./examples/open-source-bakeoff/run-presenton.ps1
```

Do not put API keys into request JSON or commit shell history containing secrets. This environment's Docker Engine was unavailable, so these commands were not passed off as a completed run.

## Matplotlib

The isolated Matplotlib worker uses pinned Python dependencies. Its example data are explicitly fictional and linked to the existing unverified `E_SYN_01` fixture source.

```powershell
npm run deps:matplotlib
npm run render:matplotlib
node src/qa.mjs outputs/matplotlib-synthetic/matplotlib-synthetic.pptx
node scripts/preview.mjs outputs/matplotlib-synthetic/matplotlib-synthetic.pptx
```

The `.pptx` contains native warning/lineage text and an SVG picture. The chart is not a native editable PowerPoint chart. Inspect the fixture values before reuse; they are not measurements.

## PPTAgent

Current upstream Skill checkout and `pptagent-task.json` are used for an offline/manual authoring attempt. Upstream supports a fixed task folder with nine HTML slides, local rendering/review and editable PPTX export. The generation Skill itself can use the host coding agent; a model-based visual-review configuration may make an external API call. No such call was made.

The official workflow requires Linux/WSL or macOS, Python 3.11+, uv, npm and LibreOffice. This Windows environment lacked LibreOffice and WSL could not start; the native Windows dependency installation also stopped at `fasttext==0.9.3` requiring Microsoft C++ Build Tools. See the exact failure record in `BACKEND_BAKEOFF.md`.
