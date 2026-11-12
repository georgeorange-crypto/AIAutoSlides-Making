# Baseline audit — 2026-11-12

## Repository state

- Worktree: `dev`, HEAD `671538b444430f42d45833c2e39eef773a43c3a3`.
- `origin/dev` resolves to the same commit at audit time; `origin/main` is `444ae66f92cd017db1e57926500af0caedd29806` (`git ls-remote` read only). No fetch, checkout, or remote write was performed.
- The tree already contained many modified tracked and untracked files when this audit began. These are user work and were preserved. This audit adds three reports and updates the existing Tool Matrix.
- Runtime: Node `v24.14.0`, npm `11.9.0`; package pins: PptxGenJS `4.0.1`, fflate `0.8.3`, pdfjs-dist `5.4.624` (from lock/install and generated review artifacts).
- Candidate checkout SHAs and runtime evidence: [`POC_RESULTS.md`](POC_RESULTS.md). The current public `main` package manifest still describes the small Node/PptxGenJS MVP; local development is materially ahead. A commit comparison does not prove all remote files or services are healthy.

## Existing product claims against code

The source of this comparison is [`PRODUCTIZATION_AND_DESIGN_QA.md`](PRODUCTIZATION_AND_DESIGN_QA.md), which itself explicitly distinguishes implemented from proposed behavior.

| Q | Capability claimed in Q&A | Status | Evidence / boundary |
|---|---|---|---|
| Q1 | Windows or Android app | **missing** | No packaged GUI or mobile client. The current product is a local Node CLI. |
| Q2 | Codex/Claude/general Agent integration | **partial** | OpenAI storyboard API is an optional outbound draft path; the tool catalog and Slidev/PptxGenJS adapters are local capabilities. No general MCP server or HTTP job API is present. |
| Q3 | Audience-aware narrative, design and timing | **partial** | Audience fields, draft planning and deterministic critic rules exist. They do not establish semantic content selection, broad media planning, aesthetic judgment or rehearsed duration. AI text remains draft. |
| Q4 | Persistent preferences and multi-question personalization | **partial** | Themes and explicit project-level design selection exist; no durable user profile or guided preference interview was found. |
| Q5 | Web research and media library | **partial** | Local PDF/DOCX extraction and source hashes exist. No active web/academic search, generalized media ingest, OCR-independent verification or licensed asset library is established. |

## Baseline commands and outcomes

| Command | Outcome |
|---|---|
| `npm run validate` | **Pass**, 7 slides. Three warnings retained: chart sample size absent; evidence E1 and E2 are unverified. |
| `npm run build` | **Pass**, generated 7-slide `outputs/research-demo.pptx`; same three warnings. |
| `npm run test` | Final rerun: **85/85 passed**. An earlier run had one transient table QA assertion failure; the isolated table test and complete rerun both passed. |
| `npm run preview` | One run completed with PowerPoint 16.0 and Poppler `pdftoppm 26.07.0`; all 7 1600×900 pages were opened and inspected, with no obvious clipping/overlap. After the final rebuild, a fresh preview attempt hung in PowerPoint COM before PDF/PNG creation and was stopped. The final build therefore has **no current preview files** and its QA reports `render_blocked`; the earlier visual inspection is not claimed as approval of the final PPTX hash. |

The structural QA report records 7/7 text-editable slides, 111 native shapes, 1 native chart, 1 embedded workbook, exact chart-value match and minimum theme contrast 4.85:1. These figures do not verify the research claims. `node src/qa.mjs outputs/research-demo.pptx` passes with warning and identifies visual review as blocked because the final rebuild's preview did not complete. The preview script removed its stale outputs before the blocked attempt, so do not treat `outputs/research-demo.preview.json` or page images as current artifacts.

## Phase-0 scope decision

This round is baseline and competitive POC only. Do not begin the Phase-1 architecture rewrite until the missing candidate runs, shared-input comparisons, and full test rerun are recorded. Current implementation is not a GUI product, MCP service, generic research agent, or multi-engine orchestrator.
