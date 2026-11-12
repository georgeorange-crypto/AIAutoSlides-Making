#!/usr/bin/env python3
"""Narrow, local-only MarkItDown worker. Input paths must remain under allowed_root."""
import argparse
import hashlib
import importlib.metadata
import json
import pathlib
import sys

MAX_SOURCE_BYTES = 50 * 1024 * 1024
MAX_MARKDOWN_CHARS = 5 * 1024 * 1024
ALLOWED_SUFFIXES = {".csv", ".docx", ".html", ".htm", ".json", ".md", ".pdf", ".pptx", ".txt", ".xlsx", ".xml"}


def resolve_input(raw_path: str, raw_root: str) -> pathlib.Path:
    root = pathlib.Path(raw_root).resolve(strict=True)
    source = pathlib.Path(raw_path).resolve(strict=True)
    if not source.is_relative_to(root):
        raise ValueError("input resolves outside allowed_root")
    if not source.is_file():
        raise ValueError("input must be a regular file")
    if source.suffix.lower() not in ALLOWED_SUFFIXES:
        raise ValueError("input extension is not in the local conversion allowlist")
    if source.stat().st_size > MAX_SOURCE_BYTES:
        raise ValueError("input exceeds the 50 MiB source limit")
    return source


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input")
    parser.add_argument("--allowed-root")
    parser.add_argument("--version", action="store_true")
    args = parser.parse_args()
    try:
        version = importlib.metadata.version("markitdown")
        if args.version:
            print(json.dumps({"available": True, "version": version}))
            return 0
        if not args.input or not args.allowed_root:
            raise ValueError("--input and --allowed-root are required for conversion")
        source = resolve_input(args.input, args.allowed_root)
        from markitdown import MarkItDown

        # convert_local is deliberately narrower than convert(), which accepts URIs.
        converter = MarkItDown(enable_plugins=False)
        result = converter.convert_local(str(source))
        markdown = result.markdown
        if not isinstance(markdown, str) or not markdown.strip():
            raise ValueError("MarkItDown returned no Markdown content")
        if len(markdown) > MAX_MARKDOWN_CHARS:
            raise ValueError("converted Markdown exceeds the 5 MiB text limit")
        raw = source.read_bytes()
        record = {
            "schema_version": "1.0.0",
            "source": {
                "source_id": "SRC_" + hashlib.sha256(raw).hexdigest()[:16].upper(),
                "filename": source.name,
                "sha256": hashlib.sha256(raw).hexdigest(),
                "bytes": len(raw),
            },
            "converter": {"id": "markitdown", "version": version, "plugins_enabled": False, "network": "not-requested"},
            "content": {"format": "text/markdown", "text": markdown},
            "locators": [{"locator": "document", "locator_type": "document"}],
            "verification_status": "unverified",
            "limitations": [
                "Markdown conversion is text-oriented and does not preserve exact layout or page coordinates.",
                "Extracted text and tables are unverified; compare factual excerpts with the original file.",
                "No network resource, remote URI, plugin, OCR service, or cloud API is invoked by this worker.",
            ],
        }
        print(json.dumps(record, ensure_ascii=False))
        return 0
    except Exception as exc:  # Worker errors cross the process boundary as a small JSON error.
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
