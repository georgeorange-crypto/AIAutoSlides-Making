# Presenton runtime evidence

Presenton v0.9.12-beta completed its authenticated nine-slide API/layout/export loop using a deterministic local OpenAI-compatible mock. This verified service wiring and export, **not model inference or AI content quality**. The official image digest and commit, 10 mock completions, exported file details, OOXML object counts, per-slide visual findings and reproduction commands are recorded in [`docs/PRESENTON_POC.md`](../../../docs/PRESENTON_POC.md).

The sanitized Open XML object report is [`runtime-object-report.json`](runtime-object-report.json). Local PPTX/PDF/PNG outputs live only under ignored `outputs/open-source-bakeoff/presenton-mock/`; they are not committed. No API token, administrator password, database or container logs are retained.
