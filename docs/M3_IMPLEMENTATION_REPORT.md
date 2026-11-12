# Milestone 3 — Presentation Intelligence implementation report

**Status:** Local review, profile-aware criticism, confirmed theme selection, and human-approval gate implemented; optional AI drafting remains opt-in. No API call was made. The project owner selected `keynote-minimal` from the rendered gallery, and it is now the default demo theme.

## Delivered

- **Rule-linked Slide Critic:** `src/critique.mjs` writes human-readable and JSON reports. Findings include rule ID, severity, stable slide ID or deck-level location, element field, concrete suggestion, and source link. Rules cover audience/goal/duration metadata, assertion–evidence framing, unverified sources, missing chart sample counts/descriptions, chart explanatory notes, long titles and long body text. It is advisory and does not assign subjective scores.
- **Readable chart descriptions:** optional `figure_description` is validated and passed to PowerPoint speaker notes. The author must supply it; the program does not infer accessible descriptions from values.
- **Audience-aware optional AI draft:** `src/ai-plan.mjs` requests strict JSON Schema output, accepts audience profile, goal and talk duration, and restricts citation IDs to the loaded evidence ledger. It writes editable JSON plus a review report and checklist. It is still an explicit OpenAI API call and was not run in this task.
- **Numeric claim screen:** generated title/body numeric literals absent from the supplied brief are flagged. This only compares token presence; it cannot establish semantics, units, or truth and can miss paraphrased or word-form numbers.
- **Content-bound human gate:** AI storyboard copies marked `requires_human_review:true` cannot build while pending. `src/review-draft.mjs` writes a separate editable approval/rejection copy, records reviewer/note/time and critic rule IDs, requires explicit acknowledgment of all critic findings for approval, and binds the approval to a storyboard content hash. Any edit after approval makes the build gate fail until review is repeated.
- **Three-theme comparison:** `src/theme-gallery.mjs` builds and locally renders cover+chart previews in the three project themes. `src/select-design.mjs` writes confirmed Markdown design guidance plus JSON tokens only after an explicit theme, reviewer, and confirmation are supplied. The user selected `keynote-minimal`; the selected tokens and preview references are recorded in `docs/design.md` and `docs/design-tokens.json`.
- **Confirmed project theme:** the user chose `keynote-minimal`; `docs/design.md` and `docs/design-tokens.json` record the selection and the example deck/AI-planner default now use it.
- Updated README/schema/research mapping and CI artifact upload for the base demo’s critic reports. Existing proprietary templates, fonts, and assets were not copied.

## Verification

| Check | Result |
|---|---|
| `npm test` | Passed, 35/35 tests, including CLI-confirmed theme output, profile-specific checks, timing-window review, and editable chart descriptions in PPTX notes. |
| `npm run check` | Passed: prior M1/M2 pipeline, builds, editable-chart QA, dual-deck build, and offline Slide Critic report. Existing unverified/synthetic evidence warnings remain visible. |
| Human approval integration | Passed: pending AI draft build blocked; approved reviewed copy built; edited-after-approval copy blocked as stale. |
| Optional AI safety/help | `node src/ai-plan.mjs --help` works without an API key. No API request or paid call was made. |
| Theme gallery | Three themes × two pages rendered to PNG with local PowerPoint; all six thumbnails were manually inspected; the user selected `keynote-minimal`. The resulting 7-page keynote demo was rendered to PDF/PNG and each page was manually inspected. Typography, contrast and evidence labels were legible; the chart's unit label sits close to the plot frame and is a small spacing refinement for a later layout pass. |
| `git diff --check` | Passed; only Git line-ending normalization notices. |

The example critic report flags missing audience/goal metadata, unverified sources and the chart’s absent sample count. These are intended review findings, not defects masked as passes. The research demo remains an unverified example.

## Limits and next step

- The numeric screen is not semantic hallucination detection. Human source comparison remains mandatory; no model output can automatically turn `verified:false` into verified evidence.
- Conference timing advice differs by venue and year. The critic requests target duration and leaves compliance to reviewers; it does not enforce an arbitrary slides-per-minute rule.
- Gallery selection records a specific theme and reviewer, but selecting a style does not validate slide-level choices for every future deck; run the preview and review workflow for each output.
- Actual AI generation was not exercised because it would send the supplied brief and evidence ledger to an external paid API. The code path is opt-in and must only be run with authorized, non-confidential content.

Next M3 objective: improve claim-to-source semantic review without weakening the human gate, and evaluate critic precision/recall against a small manually annotated set before adding more rules. The selected theme is recorded; future decks still need per-output preview review.
