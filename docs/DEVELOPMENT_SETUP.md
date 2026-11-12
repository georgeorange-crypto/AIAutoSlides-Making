# Development setup

This guide distinguishes the portable core from optional tools with separate runtimes. It is written for a fresh fork and does not assume that ignored `outputs/` folders or another developer's machine-local tools are present.

## Fastest path: Docker

Install Docker Desktop (Windows/macOS) or Docker Engine + Compose (Linux), clone the repository, then run from its root:

```sh
docker compose build
docker compose run --rm slides npm run check
docker compose run --rm slides npm run build
docker compose run --rm slides npm run preview
```

The image includes Node.js 22, root npm dependencies, LibreOffice Impress, Poppler, and basic Latin/CJK fonts. It supports deterministic local builds, tests, PDF export, and PNG page rasterization. The repository is bind-mounted, so source edits and `outputs/` are visible on the host. The Compose service does not start the REST API or expose a port. No API key, model, private source file, or hosted service is configured.

The first build needs an internet connection to fetch the base image, apt packages, and pinned npm packages. Later commands can run offline while their image and packages remain cached. Docker cannot provide Windows PowerPoint COM; it uses LibreOffice instead. Generated previews still require human visual inspection.

## Native setup: Windows PowerShell

Install Node.js 22.5 or newer with npm, then from the repository root:

```powershell
.\scripts\setup.ps1
npm run build
npm run preview
```

The setup script runs `npm ci`, checks the declared runtime dependencies, runs tests and validates the sample. PDF export requires PowerPoint or LibreOffice; PNG export requires Poppler. Missing preview tools produce a warning because PPTX generation itself does not need Office.

Optional profiles install isolated runtimes:

```powershell
.\scripts\setup.ps1 -Profile documents  # MarkItDown Python environment
.\scripts\setup.ps1 -Profile diagrams   # Mermaid CLI + its browser runtime
.\scripts\setup.ps1 -Profile research   # locked Python research tools + Chromium
.\scripts\setup.ps1 -Profile all        # all three profiles above
```

These profiles download packages and, for Mermaid/research, browser binaries. Use `-SkipChecks` to skip the test and sample-validation pass after installation. The script does not install Windows system software, external AI models, or API credentials.

## Native setup: Linux/macOS

Install Node.js 22.5 or newer, npm, and (for optional profiles) Python 3.12 and Bash:

```sh
bash scripts/setup.sh
npm run build
npm run preview
```

Use the same profile names as on Windows, for example `bash scripts/setup.sh all`. The `research` profile installs an isolated Python environment and Chromium; it can take substantial disk space and time. `bash scripts/setup.sh core --skip-checks` skips tests and validation.

## Profiles and external prerequisites

| Capability | Installation | Extra requirement |
|---|---|---|
| Core CLI, PPTX generation, validation, API and tests | `npm ci` or setup `core` | Node.js 22.5+ and npm |
| PDF/PNG preview, container path | Docker Compose | Docker daemon and first-build network access |
| PDF/PNG preview, native path | System package manager | PowerPoint or LibreOffice plus Poppler (`pdftoppm` or `pdftocairo`) |
| MarkItDown document conversion | `documents` profile | Python 3.10–3.14; packages installed into `workers/markitdown/.venv` |
| Mermaid rendering | `diagrams` profile | Node/npm; Puppeteer downloads a Chromium browser |
| Docling/Crawl4AI research workers | `research` profile | Python 3.12; downloads Python wheels and Patchright Chromium |
| AI storyboard draft | Manual opt-in | `OPENAI_API_KEY` and a selected model; may incur provider charges |
| Google Slides / Canva account checks | Manual opt-in | User-created OAuth application and credentials; not needed for local deck generation |
| Presenton / PPTAgent / Slidev | Separate documented POC/runtime | Independent service, model, browser, WSL or license/setup choices; not installed by the base script |

`.env.example` is a reference for the OpenAI planner only. The app does not automatically load `.env`; set credentials in the process environment only when using the corresponding opt-in feature. Never commit local `.env` files or API keys.

## Troubleshooting

- `Unsupported engine` or `node:sqlite` errors: install Node.js 22.5+ and reopen the shell. This is the supported version for the complete API/test suite.
- `npm ci` fails: check access to the npm registry and retry; do not replace it with an unpinned global install.
- Preview reports no LibreOffice/PowerPoint: build and structural QA still work; install one supported PDF renderer or use the Docker path.
- Preview reports no Poppler: install Poppler and ensure `pdftoppm` or `pdftocairo` is on `PATH`.
- Optional setup fails while fetching a wheel/browser/model: core setup does not need that optional runtime; preserve the error and retry the selected profile when network/package access is available.
- To inspect available adapters and missing optional runtimes: `npm run tools -- tools list` and `npm run tools -- tools doctor <id>`.

## Docker scope

`Dockerfile` and `compose.yaml` package the local CLI development/rendering toolchain. They do not package PowerPoint, a GPU model, a production web service, or third-party API credentials. The REST API remains loopback-only and is intentionally not published from Compose. See [`API_WORKFLOW.md`](API_WORKFLOW.md) before deploying any API integration.
