# Configuration Matrix / 本机配置要求

| Component | Required? | Minimum / default | Official link | Purpose |
|---|---|---|---|---|
| Node.js + npm | Yes | Node.js >=20; validated with Node 22 | https://nodejs.org/en/download | Run generator / tests |
| PptxGenJS | Installed by npm | `^4.0.0` | https://github.com/gitbrent/PptxGenJS | Native editable PPTX |
| Git + GitHub | Recommended | Current Git | https://git-scm.com/downloads / https://github.com/new | Version control / publishing |
| PowerPoint | Optional | Recent desktop edition recommended | https://www.microsoft.com/microsoft-365/powerpoint | Edit the PPTX natively |
| LibreOffice | Optional | Any current release with Impress | https://www.libreoffice.org/download/download-libreoffice/ | PDF rendering / review |
| Poppler (`pdftoppm`) | Optional | A recent build | https://poppler.freedesktop.org/ | PDF page screenshots |
| Codex CLI | Optional, recommended | Current CLI | https://github.com/openai/codex | AI coding and iteration |
| OpenAI API key | Optional | Key + access to a Responses-capable model | https://platform.openai.com/api-keys | AI storyboard (`npm run plan:ai`) |

## Runtime profile

- Memory: no GPU necessary; normal laptop RAM is adequate for the example deck.
- Storage: small (<100MB without dependencies), plus node_modules and slide output artifacts.
- Network: needed for first npm installation and optional AI planning; not needed for generation after dependencies are installed.
- Account: no GitHub or API account required to use the offline example.
- Fonts: source themes use Aptos/Aptos Display or Arial. PowerPoint may substitute fonts if missing; check PDF preview. For Chinese presentations adjust the theme fonts to a Chinese-capable family installed on the display machine.

## Windows PowerShell troubleshooting

If PowerShell blocks `npm.ps1`, try the native command shim:

```powershell
npm.cmd install
npm.cmd run check
```

If `soffice` is not recognized, append LibreOffice's `program` folder to your `PATH`, or export PDF manually in PowerPoint.

## Secrets and research confidentiality

- `.env` is ignored in Git; never put secrets into `examples`, `README`, logs or issue descriptions.
- `npm run plan:ai` sends the local brief and evidence ledger to the configured OpenAI API, and can incur costs.
- For unpublished or sensitive research, use the offline path first and obtain permission before making external API calls.
- Reuse only third-party templates, images and brand assets when the license allows it.
