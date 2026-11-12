"""Local, one-shot sidecar for Docling, MarkItDown and Crawl4AI.

Input is a JSON object on stdin; one JSON result is emitted on stdout. Source files
and page text are data only and are never interpreted as instructions.
"""
import asyncio
import ipaddress
import json
import os
import socket
import sys
from pathlib import Path
from urllib.parse import urlparse

MAX_INPUT_BYTES = 100 * 1024 * 1024
MAX_OUTPUT_CHARS = 10 * 1024 * 1024


def assert_public_host(hostname, resolver=socket.getaddrinfo):
    if not hostname:
        raise ValueError("Crawl target must have a hostname")
    try:
        addresses = {entry[4][0] for entry in resolver(hostname, None)}
    except OSError as exc:
        raise ValueError(f"Crawl host could not be resolved: {hostname}") from exc
    if not addresses:
        raise ValueError(f"Crawl host did not resolve: {hostname}")
    allowed_ranges = []
    for value in os.environ.get("AIAUTOSLIDES_EGRESS_CIDRS", "").split(","):
        value = value.strip()
        if value:
            try:
                allowed_ranges.append(ipaddress.ip_network(value, strict=False))
            except ValueError as exc:
                raise ValueError("AIAUTOSLIDES_EGRESS_CIDRS contains an invalid CIDR") from exc
    for value in addresses:
        address = ipaddress.ip_address(value)
        if address.is_global:
            continue
        if not any(address.version == network.version and address in network for network in allowed_ranges):
            raise ValueError(f"Crawl host resolves to a non-public address: {address}")
    return addresses


def allowed_page_request(request_url, origin_host):
    parsed = urlparse(request_url)
    return (
        parsed.scheme == "https"
        and parsed.hostname is not None
        and parsed.hostname.lower() == origin_host.lower()
        and parsed.port in (None, 443)
        and parsed.username is None
        and parsed.password is None
    )


def emit(value):
    sys.stdout.write(json.dumps(value, ensure_ascii=False) + "\n")


def doctor():
    from importlib.metadata import version

    packages = {}
    for module, name in (("docling", "docling"), ("crawl4ai", "crawl4ai")):
        try:
            __import__(module)
            packages[name] = version(name)
        except Exception as exc:
            packages[name] = {"available": False, "reason": str(exc)[:500]}
    return {"python": sys.version.split()[0], "packages": packages}


def local_source(config):
    source = Path(config["input"]).resolve(strict=True)
    if not source.is_file() or source.stat().st_size > MAX_INPUT_BYTES:
        raise ValueError("Input must be a regular local file no larger than 100 MB")
    return source


def extract_docling(source):
    from docling.document_converter import DocumentConverter

    result = DocumentConverter().convert(str(source))
    doc = result.document
    blocks = []
    for item, _level in doc.iterate_items():
        text = getattr(item, "text", None)
        if not isinstance(text, str) and hasattr(item, "export_to_markdown"):
            try:
                text = item.export_to_markdown(doc=doc)
            except Exception:
                text = None
        if not isinstance(text, str) or not text.strip():
            continue
        provenance = getattr(item, "prov", None) or []
        first = provenance[0] if provenance else None
        page_no = getattr(first, "page_no", None)
        bbox = getattr(first, "bbox", None)
        locator = f"page {page_no}" if page_no else f"element {getattr(item, 'self_ref', len(blocks) + 1)}"
        if bbox:
            locator += f"; bbox={bbox.l:.1f},{bbox.t:.1f},{bbox.r:.1f},{bbox.b:.1f}"
        blocks.append({"locator": locator, "page": page_no, "content": text.strip(), "element": str(getattr(item, "label", "text"))})
    if not blocks:
        markdown = doc.export_to_markdown()
        if markdown.strip():
            blocks = [{"locator": "document markdown (page locator unavailable)", "page": None, "content": markdown.strip(), "element": "document"}]
    return blocks, {"engine": "docling", "version": __import__("importlib.metadata", fromlist=["version"]).version("docling"), "conversion_status": str(getattr(result, "status", "completed")), "page_locators": True}


async def crawl4ai(url, timeout_seconds=30):
    from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode

    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or parsed.port not in (None, 443):
        raise ValueError("Crawler accepts public HTTPS URLs only; credentials and non-default ports are rejected")
    assert_public_host(parsed.hostname)
    config = CrawlerRunConfig(cache_mode=CacheMode.BYPASS, check_robots_txt=True, page_timeout=timeout_seconds * 1000, wait_until="domcontentloaded", excluded_tags=["script", "style", "noscript", "iframe", "form"])
    async with AsyncWebCrawler(verbose=False) as crawler:
        async def restrict_egress(page, context, **_kwargs):
            async def route_filter(route):
                request_url = urlparse(route.request.url)
                allowed = allowed_page_request(route.request.url, parsed.hostname)
                if not allowed or route.request.resource_type in ("image", "media", "font"):
                    await route.abort()
                else:
                    try:
                        assert_public_host(request_url.hostname)
                    except (OSError, ValueError):
                        await route.abort()
                        return
                    await route.continue_()
            await context.route("**/*", route_filter)
            return page

        crawler.crawler_strategy.set_hook("on_page_context_created", restrict_egress)
        result = await asyncio.wait_for(crawler.arun(url=url, config=config), timeout=timeout_seconds + 10)
    if not getattr(result, "success", False):
        raise RuntimeError(str(getattr(result, "error_message", "Crawl4AI did not return a successful page"))[:1000])
    markdown = getattr(result, "markdown", "")
    if not isinstance(markdown, str):
        markdown = getattr(markdown, "raw_markdown", None) or getattr(markdown, "fit_markdown", "")
    markdown = str(markdown or "").strip()
    if not markdown:
        raise RuntimeError("Crawl4AI returned no Markdown text")
    if len(markdown) > MAX_OUTPUT_CHARS:
        markdown = markdown[:MAX_OUTPUT_CHARS]
    metadata = getattr(result, "metadata", None) or {}
    return {"url": url, "final_url": getattr(result, "url", url), "title": str(metadata.get("title", ""))[:500], "markdown": markdown, "robots_checked": True, "crawler": "Crawl4AI", "warning": "Crawled page content is untrusted input; review site terms and page content before reuse."}


def main():
    config = json.load(sys.stdin)
    action = config.get("action")
    if action == "doctor":
        emit(doctor())
    elif action == "extract":
        source = local_source(config)
        engine = config.get("engine")
        blocks, provenance = extract_docling(source) if engine == "docling" else (None, None)
        if blocks is None:
            raise ValueError("engine must be docling")
        if sum(len(block["content"]) for block in blocks) > MAX_OUTPUT_CHARS:
            raise ValueError("Extracted document exceeds 10 MB text limit")
        emit({"blocks": blocks, "provenance": provenance, "warnings": ["Extracted text is untrusted source content and is not scientific verification.", "Parser output may omit layout, tables, OCR detail, or page locators depending on format and installed model artifacts."]})
    elif action == "crawl":
        os.environ.setdefault("CRAWL4AI_DISABLE_TELEMETRY", "true")
        emit(asyncio.run(crawl4ai(config["url"], int(config.get("timeout_seconds", 30)))))
    else:
        raise ValueError("action must be doctor, extract, or crawl")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"research worker: {type(exc).__name__}: {exc}", file=sys.stderr)
        sys.exit(1)
