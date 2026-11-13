"""Inspect OOXML editability counts for a local Presenton POC artifact."""
import json
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"

path = Path(sys.argv[1])
result = {"file": path.name, "slide_count": 0, "slides": [], "totals": {"text_shapes": 0, "native_shapes": 0, "pictures": 0, "graphic_frames": 0, "native_charts": 0, "tables": 0, "notes_pages": 0, "external_relationships": 0}}
with zipfile.ZipFile(path) as archive:
    names = set(archive.namelist())
    slide_names = sorted((n for n in names if n.startswith("ppt/slides/slide") and n.endswith(".xml") and "/_rels/" not in n), key=lambda n: int(n.rsplit("slide", 1)[1][:-4]))
    result["slide_count"] = len(slide_names)
    result["totals"]["notes_pages"] = sum(n.startswith("ppt/notesSlides/notesSlide") and n.endswith(".xml") and "/_rels/" not in n for n in names)
    for slide_name in slide_names:
        root = ET.fromstring(archive.read(slide_name))
        shapes = root.findall(f".//{P}sp")
        pics = root.findall(f".//{P}pic")
        frames = root.findall(f".//{P}graphicFrame")
        text_shapes = [s for s in shapes if s.find(f"{P}txBody") is not None and any(t.text for t in s.findall(f".//{A}t"))]
        texts = [t.text for t in root.findall(f".//{A}t") if t.text]
        rel_name = slide_name.replace("slides/", "slides/_rels/") + ".rels"
        rel_data = archive.read(rel_name).decode("utf-8") if rel_name in names else ""
        chart_count = rel_data.count("/chart")
        external = rel_data.count('TargetMode="External"')
        tables = sum(1 for frame in frames if frame.find(f".//{A}tbl") is not None)
        slide_number = int(slide_name.rsplit("slide", 1)[1][:-4])
        note_name = f"ppt/notesSlides/notesSlide{slide_number}.xml"
        note_text = []
        if note_name in names:
            note_root = ET.fromstring(archive.read(note_name))
            note_text = [t.text for t in note_root.findall(f".//{A}t") if t.text]
        slide = {"slide": slide_number, "text_shapes": len(text_shapes), "native_shapes": len(shapes), "pictures": len(pics), "graphic_frames": len(frames), "native_charts": chart_count, "tables": tables, "external_relationships": external, "visible_text": texts, "speaker_note_text": note_text}
        result["slides"].append(slide)
        for key in ("text_shapes", "native_shapes", "pictures", "graphic_frames", "native_charts", "tables", "external_relationships"):
            result["totals"][key] += slide[key]
    print(json.dumps(result, ensure_ascii=False, indent=2))
