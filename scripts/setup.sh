#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-core}"
SKIP_CHECKS="${2:-}"
case "$PROFILE" in
  core|documents|diagrams|research|all) ;;
  *) echo "Usage: bash scripts/setup.sh [core|documents|diagrams|research|all] [--skip-checks]" >&2; exit 2 ;;
esac
if [[ "$SKIP_CHECKS" != "" && "$SKIP_CHECKS" != "--skip-checks" ]]; then
  echo "Unknown option: $SKIP_CHECKS" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js 22.5+ is required. Install the current Node.js LTS release, or use Docker Compose.' >&2
  exit 1
fi
NODE_VERSION="$(node -p 'process.versions.node')"
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a > 22 || (a === 22 && b >= 5) ? 0 : 1)'; then
  echo "Node.js $NODE_VERSION is too old; install Node.js 22.5+ and rerun setup." >&2
  exit 1
fi
command -v npm >/dev/null 2>&1 || { echo 'npm is required; reinstall Node.js with npm enabled.' >&2; exit 1; }

echo "Using Node.js $NODE_VERSION"
npm ci --no-audit --no-fund
npm run deps

if [[ "$PROFILE" == documents || "$PROFILE" == all ]]; then npm run deps:markitdown; fi
if [[ "$PROFILE" == diagrams || "$PROFILE" == all ]]; then npm ci --prefix workers/mermaid --no-audit --no-fund; fi
if [[ "$PROFILE" == research || "$PROFILE" == all ]]; then bash workers/research/install.sh; fi

if [[ "$SKIP_CHECKS" != "--skip-checks" ]]; then
  npm run test
  npm run validate
fi

command -v soffice >/dev/null 2>&1 || echo 'Optional: install LibreOffice to export PPTX to PDF (Docker Compose includes it).'
command -v pdftoppm >/dev/null 2>&1 || echo 'Optional: install Poppler for page PNG previews (Docker Compose includes it).'
echo "Setup complete (profile: $PROFILE). Use 'npm run build' to generate the sample PPTX."
echo 'Optional AI providers, model weights, Slidev/PPTAgent runtimes, and cloud credentials are not installed or configured by this script.'
