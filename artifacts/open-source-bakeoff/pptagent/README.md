# PPTAgent POC artifacts

This directory stores the synthetic 9-slide PPTAgent backend proof-of-concept.

- `answer.pptx`: editable deck (SHA-256 recorded in `final-report.json`).
- `answer.pdf`: PDF exported by the upstream review-deck workflow.
- `pages/`: nine rendered JPGs that were visually reviewed; `pages/png/` has PNG conversions of those reviewed page renders for convenient viewing.
- `visual-qa.md`: per-page findings and overall human review disposition.
- `html/`: the nine input HTML slide sources used by the converter.
- `create-slides.mjs`: deterministic fixture source generator.
- `audit-pptx-objects.mjs`, `object-audit.json`: reproducible OOXML object inventory.
- `final-report.json`, `workspace-state.json`: upstream PPTAgent completion and review/hash evidence.

All deck figures and claims are synthetic/hypothetical. No real research data or external model output is present.
