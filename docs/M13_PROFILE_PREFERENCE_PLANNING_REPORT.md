# M13 — Profile preferences in deterministic planning

Date: 2026-11-12

## Change

The local preference profile already stored `language`, `tone`, and `slide_density`, but the deterministic content plan did not expose them. `planPresentationIntelligence()` now returns these three values under `authoring_preferences`. A directly supplied Presentation IR metadata value takes precedence over the profile default. Missing preferences are returned as `null`.

The report describes these fields as authoring guidance. They do not translate or rewrite slide text, verify claims, alter the rendering backend, or change the source IR. Audience, duration, and theme defaults retain their existing behavior.

## Verification

- `npm run test`: passed, **184/184**.
- `npm run validate`: passed, 7 slides, with the existing three warnings: missing chart sample size; evidence `E1` and `E2` unverified.
- `npm run build`: passed; generated the seven-slide example deck and review report.
- `npm run preview`: passed with PowerPoint 16.0 and Poppler 26.07.0; rendered seven PNG pages. Each page was opened and visually inspected; no apparent clipping or overlap was found.
- Added regression coverage for profile preference propagation and explicit IR override precedence.

## Acceptance boundary

The software path is verified for planner output. No profile-backed LLM request or rewritten deck was generated; no translation quality or tone/density compliance is established. Scientific review remains pending for `E1` and `E2`; the sample chart still has no recorded sample size. Human approval of content/design remains separate from this structural and visual inspection.
