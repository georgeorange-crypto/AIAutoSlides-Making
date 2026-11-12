# Codex and Claude Code Skills slice

Status: **implemented and locally verified**.

## What changed

- Added one AIAutoSlides presentation workflow Skill and placed it in the project discovery locations for Codex (`.agents/skills/aiautoslides/SKILL.md`) and Claude Code (`.claude/skills/aiautoslides/SKILL.md`). `skills/aiautoslides/SKILL.md` is the canonical copy; a regression test enforces exact synchronization.
- The workflow covers source inspection, deterministic evidence-linked storyboards, local asset provenance, validate/build/QA/preview, per-slide visual inspection, speaker notes, and delivery of manifests and review reports.
- It preserves the draft/unverified boundary for AI planning and requires explicit user authorization before an external AI request. It does not call a model, access the network, create credentials, or upload files by itself.
- The MCP section directs clients to the local stdio server and requires approval for writes; the documented API remains loopback-only.
- Updated the README and capability answers to describe these tools accurately. Corrected Q6 to distinguish existing local PDF/DOCX text extraction and offline PDF OCR from still-missing embedded-image extraction.

## Verification

- `npm test`: **132 passed, 0 failed**.
- `node --check src/mcp.mjs`: passed.
- `git diff --check`: passed before the report was added.
- `npm run build`: passed; emitted the existing 7-slide research demo deck. Expected warnings remain for a missing chart sample-size field and unverified E1/E2 evidence.
- `npm run preview`: passed with PowerPoint 16.0 and Poppler, rendered PDF and all 7 PNG pages; every page was opened and inspected.
- Visual issue retained for a separate content/layout repair: slide 1's oversized cover title extends into the decorative right panel. The other six pages showed no apparent clipping or overlap at rendered size. No scientific or human approval was inferred.

## Scope boundary

This adds project-scoped Skills; it does not publish a plugin or upload Skill bundles to an external API. Current supported surfaces are local CLI, local REST, stdio MCP, and project Skills. Remote MCP/authentication, general UI, research crawling, remote full-text extraction, and scientific verification remain incomplete. No storyboard or JSON Schema contract changed.
