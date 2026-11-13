#!/usr/bin/env python3
"""Render a bounded, deterministic chart JSON file to SVG and PNG."""
import hashlib
import json
import math
import os
import sys
from pathlib import Path
from xml.etree import ElementTree

os.environ.setdefault("MPLBACKEND", "Agg")
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

MAX_INPUT_BYTES = 1_000_000
MAX_POINTS = 2000
KINDS = {"line", "bar", "scatter", "cdf"}
COLORS = ["#2563EB", "#DC2626", "#059669", "#7C3AED", "#D97706", "#0891B2"]


def fail(message):
    raise ValueError(message)


def validate(data):
    if not isinstance(data, dict) or data.get("schema_version") != "1.0.0":
        fail("figure input must be a JSON object with schema_version 1.0.0")
    if not isinstance(data.get("figure_id"), str) or not data["figure_id"].strip():
        fail("figure_id must be a non-empty string")
    if data.get("kind") not in KINDS:
        fail("kind must be one of line, bar, scatter, cdf")
    for field in ("title", "x_label", "y_label"):
        if not isinstance(data.get(field), str) or not data[field].strip() or len(data[field]) > 300:
            fail(f"{field} must be a non-empty string of at most 300 characters")
    x = data.get("x")
    series = data.get("series")
    if not isinstance(x, list) or not 2 <= len(x) <= MAX_POINTS:
        fail(f"x must contain 2 to {MAX_POINTS} observations")
    if not all(isinstance(item, (str, int, float)) and not isinstance(item, bool) and (not isinstance(item, float) or math.isfinite(item)) for item in x):
        fail("x must contain only finite numbers or strings")
    if not isinstance(series, list) or not 1 <= len(series) <= 12:
        fail("series must contain 1 to 12 named series")
    for item in series:
        if not isinstance(item, dict) or not isinstance(item.get("name"), str) or not item["name"].strip() or len(item["name"]) > 100:
            fail("each series must have a non-empty name of at most 100 characters")
        values = item.get("y")
        if not isinstance(values, list) or len(values) != len(x):
            fail("each series y array must have the same length as x")
        if not all(isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) for value in values):
            fail("series values must be finite numbers")
    if data["kind"] in {"line", "cdf", "scatter"} and not all(isinstance(value, (int, float)) and not isinstance(value, bool) for value in x):
        fail("line, scatter, and cdf charts require numeric x values")
    if data["kind"] == "bar" and len({isinstance(value, str) for value in x}) > 1:
        fail("bar x values must be all strings or all numbers")
    if data["kind"] == "cdf":
        if any(right < left for left, right in zip(x, x[1:])):
            fail("cdf x values must be nondecreasing")
        for item in series:
            if any(right < left for left, right in zip(item["y"], item["y"][1:])):
                fail("cdf series values must be nondecreasing")
            if any(value < 0 or value > 1 for value in item["y"]):
                fail("cdf series values must be within [0, 1]")
    source_ids = data.get("source_ids")
    if not isinstance(source_ids, list) or not source_ids or not all(isinstance(source_id, str) and source_id.strip() for source_id in source_ids):
        fail("source_ids must contain at least one non-empty evidence/source identifier")


def main():
    if len(sys.argv) != 3:
        fail("usage: render_chart.py <input.json> <output-directory>")
    source = Path(sys.argv[1]).resolve(strict=True)
    output_dir = Path(sys.argv[2]).resolve()
    if source.suffix.lower() != ".json" or not source.is_file():
        fail("input must be a regular .json file")
    raw = source.read_bytes()
    if not raw or len(raw) > MAX_INPUT_BYTES:
        fail(f"input must be from 1 byte to {MAX_INPUT_BYTES} bytes")
    data = json.loads(raw.decode("utf-8"))
    validate(data)
    output_dir.mkdir(parents=True, exist_ok=True)
    svg_path, png_path = output_dir / "figure.svg", output_dir / "figure.png"
    manifest_path = output_dir / "figure-manifest.json"
    if any(path.exists() for path in (svg_path, png_path, manifest_path)):
        fail("figure output already exists; refusing to overwrite")

    matplotlib.rcParams.update({
        "svg.hashsalt": "ai4slides-matplotlib-v1",
        "svg.fonttype": "none",
        "font.family": "DejaVu Sans",
        "text.usetex": False,
        "axes.spines.top": False,
        "axes.spines.right": False,
    })
    fig, ax = plt.subplots(figsize=(10.5, 5.7), constrained_layout=True)
    try:
        kind = data["kind"]
        for index, item in enumerate(data["series"]):
            color = COLORS[index % len(COLORS)]
            if kind == "line":
                ax.plot(data["x"], item["y"], marker="o", linewidth=2.1, markersize=5, label=item["name"], color=color)
            elif kind == "scatter":
                ax.scatter(data["x"], item["y"], s=52, label=item["name"], color=color, edgecolors="white", linewidths=0.7)
            elif kind == "bar":
                width = 0.8 / len(data["series"])
                offsets = [(j - (len(data["series"]) - 1) / 2) * width for j in range(len(data["series"]))]
                positions = list(range(len(data["x"])))
                ax.bar([position + offsets[index] for position in positions], item["y"], width=width, label=item["name"], color=color)
                ax.set_xticks(positions, data["x"])
            else:
                ax.step(data["x"], item["y"], where="post", linewidth=2.1, label=item["name"], color=color)
                ax.scatter(data["x"], item["y"], s=22, color=color, zorder=3)
        ax.set_title(data["title"], loc="left", fontsize=18, fontweight="semibold", pad=16)
        ax.set_xlabel(data["x_label"], fontsize=11, labelpad=8)
        ax.set_ylabel(data["y_label"], fontsize=11, labelpad=8)
        ax.grid(axis="y", color="#CBD5E1", linewidth=0.7, alpha=0.65)
        ax.set_axisbelow(True)
        if len(data["series"]) > 1:
            ax.legend(frameon=False, loc="best")
        fig.savefig(svg_path, format="svg", metadata={"Date": None, "Creator": "AIAutoSlides Matplotlib adapter"})
        fig.savefig(png_path, format="png", dpi=180, metadata={"Software": "AIAutoSlides Matplotlib adapter"})
    finally:
        plt.close(fig)

    svg_root = ElementTree.parse(svg_path).getroot()
    if not svg_root.tag.endswith("svg"):
        fail("Matplotlib did not create a valid SVG root")
    artifacts = []
    for file_path, media_type in ((svg_path, "image/svg+xml"), (png_path, "image/png")):
        content = file_path.read_bytes()
        artifacts.append({"path": file_path.name, "media_type": media_type, "bytes": len(content), "sha256": hashlib.sha256(content).hexdigest()})
    manifest = {
        "schema_version": "1.0.0",
        "tool": {"id": "matplotlib", "version": matplotlib.__version__},
        "python_version": sys.version.split()[0],
        "figure_id": data["figure_id"],
        "kind": data["kind"],
        "title": data["title"],
        "input": {"path": source.name, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()},
        "source_ids": data["source_ids"],
        "observations": len(data["x"]),
        "series": [item["name"] for item in data["series"]],
        "data_transform": "none; plotted x/y values match input JSON",
        "artifacts": artifacts,
        "editability": {"svg": "vector image object in PPTX; chart elements are not native PowerPoint objects", "png": "raster image"},
        "warnings": ["Automated rendering does not verify source truth or evidence IDs.", "SVG embedded in PPTX is a picture object, not a native editable chart."]
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # Report a stable, bounded CLI error.
        print(f"matplotlib worker: {error}", file=sys.stderr)
        raise SystemExit(1)
