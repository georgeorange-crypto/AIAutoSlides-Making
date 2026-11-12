# Milestone 3A follow-on — editable code snippet slide

Date: 2026-11-12 · Scope: one deterministic, source-linked code layout.

## Delivered

- Added a `code` slide with a constrained language, filename, source lines, evidence IDs, and speaker notes.
- Each displayed source line is a native editable PowerPoint text object. Lines wider than 88 characters wrap at whitespace or punctuation when possible; concatenating the display segments reconstructs the source line exactly.
- The evidence manifest retains the original lines, language, filename, source IDs, locators and source hashes. QA checks the order and exact text of every native code object against the storyboard.
- Added a synthetic fixture with a long line that exercises wrapping.

## Verification

| Check | Result |
|---|---|
| Targeted tests | Passed: 23 tests, including snippet validation, wrap preservation, PPTX editability, evidence lineage and QA exact-match. |
| Full `npm run check` | The latest shared-worktree test run reached 116 tests: 115 passed and one unrelated uncommitted local API lifecycle test failed (`tests/api.test.mjs`: job state was `running` rather than `completed`). The earlier Slidev IR assertion wording failure is resolved; the full check chain still stops at the test stage. |
| Example | Validated and built: 2 slides, 6 native code text objects (five source lines, one wrapped). |
| QA | No structural errors; exact code match true. Evidence warning is expected because the fixture is synthetic and unverified. |
| Preview | PowerPoint 16.0 exported PDF; Poppler rendered both PNG pages. Both were visually inspected; code and filename are legible and fit within the slide. |

## Limits and next phase

The code text is editable but not syntax-highlighted, parsed, or executed. Consolas availability depends on the presentation system. The display is limited to 20 visual lines; code semantics and correctness require human review. Next, finish the remaining workflow gap: consolidate the required roughly 10-slide synthetic AI Systems sample and its QA/evidence deliverables, then assess the remaining high-level planning and visual sign-off requirements.
