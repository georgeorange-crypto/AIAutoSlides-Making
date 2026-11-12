#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)"
VENV="$ROOT/.venv/research"
python3.12 -m venv "$VENV"
"$VENV/bin/python" -m pip install --upgrade pip
"$VENV/bin/python" -m pip install -r "$(dirname -- "$0")/requirements-lock.txt"
"$VENV/bin/python" -m playwright install chromium
printf 'Set AIAUTOSLIDES_PYTHON=%s/bin/python when using this runtime outside this checkout.\n' "$VENV"
