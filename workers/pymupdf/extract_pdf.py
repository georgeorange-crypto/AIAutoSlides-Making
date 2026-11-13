#!/usr/bin/env python3
"""Extract bounded PDF text/page metadata and selected page previews."""
import hashlib
import json
import sys
from pathlib import Path

import pymupdf

MAX_PDF_BYTES = 100 * 1024 * 1024
MAX_PAGES = 500
MAX_PAGE_TEXT_CHARS = 1_000_000
MAX_TOTAL_TEXT_CHARS = 20_000_000
MAX_PREVIEW_PAGES = 20
MAX_PREVIEW_PIXELS = 25_000_000
MAX_IMAGES = 100
MAX_IMAGE_BYTES = 50 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000
MAX_VECTOR_DRAWINGS_PER_PAGE = 2_000


def fail(message):
    raise ValueError(message)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def image_media_type(extension):
    extension = str(extension or "bin").lower()
    return {"jpg": "image/jpeg", "jpeg": "image/jpeg", "jpe": "image/jpeg", "png": "image/png", "tif": "image/tiff", "tiff": "image/tiff", "jp2": "image/jp2", "jpx": "image/jpx", "jb2": "image/jbig2"}.get(extension, "application/octet-stream")


def main():
    if len(sys.argv) != 4:
        fail("usage: extract_pdf.py <input.pdf> <output-directory> <preview-pages-json>")
    source = Path(sys.argv[1]).resolve(strict=True)
    output = Path(sys.argv[2]).resolve()
    previews = json.loads(sys.argv[3])
    if source.suffix.lower() != ".pdf" or not source.is_file():
        fail("input must be a regular .pdf file")
    if source.stat().st_size > MAX_PDF_BYTES:
        fail(f"PDF exceeds {MAX_PDF_BYTES} bytes")
    raw = source.read_bytes()
    if not raw.startswith(b"%PDF-"):
        fail("input does not have a PDF signature")
    if not isinstance(previews, list) or len(previews) > MAX_PREVIEW_PAGES or any(not isinstance(page, int) or isinstance(page, bool) or page < 0 for page in previews):
        fail(f"preview pages must be a list of at most {MAX_PREVIEW_PAGES} nonnegative zero-based page indexes")
    if len(set(previews)) != len(previews):
        fail("preview page indexes must be unique")
    output.mkdir(parents=True, exist_ok=True)
    expected = [output / "pages.json", output / "extracted.md", output / "pymupdf-manifest.json"]
    if any(file.exists() for file in expected):
        fail("PyMuPDF output already exists; refusing to overwrite")

    pages = []
    total_chars = 0
    preview_outputs = []
    extracted_images = []
    extracted_image_paths = {}
    extracted_image_bytes = 0
    with pymupdf.open(stream=raw, filetype="pdf") as doc:
        if doc.is_encrypted:
            fail("encrypted PDFs are not accepted by this offline parser")
        if not 1 <= doc.page_count <= MAX_PAGES:
            fail(f"PDF must contain 1 to {MAX_PAGES} pages")
        if any(index >= doc.page_count for index in previews):
            fail("preview page index is outside the PDF page range")
        for index, page in enumerate(doc):
            text = page.get_text("text", sort=True)
            if len(text) > MAX_PAGE_TEXT_CHARS:
                fail(f"page {index + 1} text exceeds {MAX_PAGE_TEXT_CHARS} characters")
            total_chars += len(text)
            if total_chars > MAX_TOTAL_TEXT_CHARS:
                fail(f"document text exceeds {MAX_TOTAL_TEXT_CHARS} characters")
            image_info = page.get_image_info(xrefs=True)
            image_count = len(image_info)
            image_refs = []
            for image in image_info[:MAX_IMAGES]:
                bbox = [round(float(value), 3) for value in image.get("bbox", ())]
                xref = int(image.get("xref", 0) or 0)
                width, height = int(image.get("width", 0) or 0), int(image.get("height", 0) or 0)
                reference = {"xref": xref, "bbox_points": bbox, "width_pixels": width, "height_pixels": height}
                if xref > 0 and xref in extracted_image_paths:
                    reference["asset_path"] = extracted_image_paths[xref]
                elif xref > 0 and len(extracted_images) < MAX_IMAGES:
                    if width <= 0 or height <= 0 or width * height > MAX_IMAGE_PIXELS:
                        image_refs.append(reference)
                        continue
                    extracted = doc.extract_image(xref)
                    image_bytes = extracted.get("image", b"")
                    if image_bytes and extracted_image_bytes + len(image_bytes) <= MAX_IMAGE_BYTES:
                        name = f"image-{xref}.{extracted.get('ext', 'bin')}"
                        target = output / name
                        target.write_bytes(image_bytes)
                        extracted_image_bytes += len(image_bytes)
                        extracted_image_paths[xref] = name
                        image_record = {"path": name, "xref": xref, "extension": extracted.get("ext"), "bytes": len(image_bytes), "sha256": sha256(image_bytes), "media_type": image_media_type(extracted.get("ext"))}
                        extracted_images.append(image_record)
                        reference["asset_path"] = name
                image_refs.append(reference)
            drawings = page.get_drawings()
            if len(drawings) > MAX_VECTOR_DRAWINGS_PER_PAGE:
                fail(f"page {index + 1} exceeds {MAX_VECTOR_DRAWINGS_PER_PAGE} vector drawing records")
            vector_records = []
            for drawing in drawings:
                rect = drawing.get("rect")
                vector_records.append({
                    "type": drawing.get("type"),
                    "bbox_points": [round(float(value), 3) for value in rect] if rect else None,
                    "item_count": len(drawing.get("items", [])),
                    "fill": list(drawing["fill"]) if drawing.get("fill") else None,
                    "color": list(drawing["color"]) if drawing.get("color") else None,
                    "width_points": round(float(drawing["width"]), 3) if drawing.get("width") is not None else None,
                })
            pages.append({
                "page_number": index + 1,
                "locator": f"page:{index + 1}",
                "width_points": round(page.rect.width, 3),
                "height_points": round(page.rect.height, 3),
                "text": text,
                "text_sha256": sha256(text.encode("utf-8")),
                "embedded_image_references": image_count,
                "images": image_refs,
                "vector_drawing_count": len(vector_records),
                "vector_drawings": vector_records,
                "text_status": "selectable-text-extracted" if text.strip() else "no-selectable-text; OCR-not-run",
            })
            if index in previews:
                preview_width, preview_height = int(page.rect.width + 0.999), int(page.rect.height + 0.999)
                if preview_width <= 0 or preview_height <= 0 or preview_width * preview_height > MAX_PREVIEW_PIXELS:
                    fail(f"page {index + 1} preview exceeds {MAX_PREVIEW_PIXELS} pixels")
                pixmap = page.get_pixmap(matrix=pymupdf.Matrix(1, 1), alpha=False, colorspace=pymupdf.csRGB)
                name = f"page-{index + 1:04d}.png"
                target = output / name
                pixmap.save(target)
                data = target.read_bytes()
                preview_outputs.append({"path": name, "page_number": index + 1, "bytes": len(data), "sha256": sha256(data), "media_type": "image/png"})

    markdown = "\n\n".join(f"## Page {page['page_number']}\n\n{page['text'].rstrip()}" for page in pages)
    pages_bytes = (json.dumps({"schema_version": "1.0.0", "pages": pages}, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    markdown_bytes = (markdown + "\n").encode("utf-8")
    (output / "pages.json").write_bytes(pages_bytes)
    (output / "extracted.md").write_bytes(markdown_bytes)
    artifacts = [
        {"path": "pages.json", "media_type": "application/json", "bytes": len(pages_bytes), "sha256": sha256(pages_bytes)},
        {"path": "extracted.md", "media_type": "text/markdown", "bytes": len(markdown_bytes), "sha256": sha256(markdown_bytes)},
        *preview_outputs,
        *[{"path": item["path"], "media_type": item["media_type"], "bytes": item["bytes"], "sha256": item["sha256"]} for item in extracted_images],
    ]
    manifest = {
        "schema_version": "1.0.0",
        "tool": {"id": "pymupdf", "version": pymupdf.__version__},
        "python_version": sys.version.split()[0],
        "input": {"path": source.name, "bytes": len(raw), "sha256": sha256(raw)},
        "page_count": len(pages),
        "extracted_image_count": len(extracted_images),
        "extracted_image_bytes": extracted_image_bytes,
        "image_extraction_limit": {"max_images": MAX_IMAGES, "max_total_bytes": MAX_IMAGE_BYTES, "max_pixels_each": MAX_IMAGE_PIXELS},
        "vector_extraction_limit_per_page": MAX_VECTOR_DRAWINGS_PER_PAGE,
        "selectable_text_pages": sum(bool(page["text"].strip()) for page in pages),
        "empty_text_pages": [page["page_number"] for page in pages if not page["text"].strip()],
        "ocr": "not-run",
        "source_ids": [],
        "verification_status": "pending",
        "artifacts": artifacts,
        "warnings": ["Extracted text and embedded images are source material, not verified evidence or licensed-for-reuse assets.", "No OCR was run; empty-text pages may be scanned or vector-only.", "Only up to 100 embedded raster images / 50 MiB / 25 million pixels per image and 2,000 vector drawing records per page are extracted.", "PyMuPDF and MuPDF are offered under AGPL or commercial terms; check the selected licensing path before distribution."],
    }
    manifest_bytes = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    (output / "pymupdf-manifest.json").write_bytes(manifest_bytes)
    print(json.dumps(manifest, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"pymupdf worker: {error}", file=sys.stderr)
        raise SystemExit(1)
