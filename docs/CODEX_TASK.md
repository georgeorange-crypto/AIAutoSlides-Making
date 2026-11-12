# Codex Implementation Brief — AIAutoSlides Making

**Role:** Senior presentation engineer, AI systems researcher, design-systems engineer and scientific QA reviewer.

## Baseline supplied by user
The repository contains a Node 20+ PptxGenJS MVP, 7-slide research demo, evidence ledger, JSON validation, three themes, an optional OpenAI Responses API storyboard stage, preview wrapper, tests and GitHub Actions.

## Immediate objective (Phase 1)
Turn the included starter into a **truly usable personal Slides engine** without redesigning the architecture gratuitously. Perform the real work in the checkout; plans alone are insufficient.

### Deliverables
1. Audit and run the repo using `npm install`, `npm run test`, `npm run validate`, `npm run build`. Read every failure; fix issues. Record dependency versions.
2. Render the demo with LibreOffice or a compatible renderer. Inspect **every slide**, not just first page. Fix cropping, contrast, labels, font substitution, visual inconsistencies. Commit preview artifacts selectively.
3. Ensure diagrams, metric cards, and charts are editable shapes or native PowerPoint chart elements. Detect image-only slides before declaring success.
4. Add rendered-slide QA beyond structural validation (basic text bounds, contrast/overflow, line wrapping). Produce both machine-readable and human-readable review reports.
5. Add one `examples/from-csv/` workflow with a provided **synthetic demo CSV**, clearly labeled synthetic. Do not invent new real experimental results.
6. Produce an accurate updated README (Windows PowerShell first, Linux second), troubleshooting, documented file paths and copy/paste commands.
7. Expand `node:test` cases including malformed evidence, missing chart values, text overflow and unsupported slide types.
8. Ensure CI installs dependencies and publishes a deck artifact. If lockfile can be generated, commit it and switch to `npm ci`.

### Acceptance criteria
- A clean checkout on Windows/Linux with Node 20+ can `npm install && npm run check`.
- Demo output has exactly **7 slides** and editable text. Native chart data is accessible inside PowerPoint.
- No fabricated numeric claims. All factual and numerical slides cite ledger IDs; unresolved verification warnings remain visible.
- All rendered slides pass visual inspection at 16:9 / 1080p; no clipping or illegible figure text.
- Documentation states honestly which outputs were actually checked.

## Phase 2 — Research-quality data visualization
- Support line, bar, scatter, CDF and waterfall/latency breakdown with appropriate units and baselines.
- Create source-to-figure-to-slide provenance manifests.
- Add repeated-run data visualization with uncertainty/error bars where data exists.
- Never fabricate confidence intervals or statistical significance.

## Phase 3 — Narrative and slide design intelligence
- Provide storyboarding with audience (advisor, academic conference, investment committee) and duration.
- Build separate Talk Deck and Reading Deck, from a shared evidence graph.
- Implement an assertion–evidence checklist and a visual critic that produces specific design change suggestions.
- Optionally compare with open-source Frontend Slides, Quarto, Slidev; document editable-PPTX tradeoffs with real examples.

## Phase 4 — Workflow / integration
- Optional private input import from local Markdown, PDF, DOCX; preserve source references.
- Optional Google Slides/PowerPoint sync only with explicit permissions.
- Optional API calls behind a deliberate command, no paid service in default CI.
- Add benchmark comparing creation time, manual repair time, editability, figure accuracy and second-run update time.

## Instruction to execute
**Do not merely write a plan.** Implement Phase 1, run commands and inspect outputs. If time/resources limit full delivery, complete and document a sound subset with test evidence and prioritized follow-up work. Ask only when an external credential or irreversible action is genuinely required.

## Required final report
- Files modified and why
- Commands run and exact outcomes
- Rendered slide count, artifacts, screenshots/contact sheet
- Source integrity / slide editability checks
- Bugs found and fixed; remaining blockers
- Link to PR/commit only if remote action genuinely occurred
