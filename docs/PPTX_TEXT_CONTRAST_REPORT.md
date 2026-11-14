# Emitted PPTX text contrast gate

Date: 2026-11-13

## Change

`src/qa.mjs` now evaluates the explicit foreground RGB value in every emitted PowerPoint text run. It compares that color with the slide's solid RGB background and any known solid shape fills intersecting the text box. The least favorable known contrast is checked against 4.5:1. A below-threshold run is a hard QA error (`TEXT-CONTRAST-001`). Text whose effective foreground or background cannot be determined is also a hard error (`TEXT-CONTRAST-UNMEASURED-001`), so unsupported formatting cannot pass by omission.

This supplements the existing theme-token pairing audit: a valid palette no longer masks a custom low-contrast color emitted on an individual run.

## Adversarial coverage

- A synthetic white-slide fixture with one dark and one pale text run catches the pale run.
- A label over a known pale solid panel is checked against both panel and slide colors.
- A text box over an image fill is marked unmeasured and fails closed.
- An integration fixture generates a real PPTX, changes one authored text-run color while leaving the theme unchanged, and verifies `src/qa.mjs` exits nonzero with the contrast finding.

## Local verification

- `npm test`: 351 tests total, 340 passed, 0 failed, 11 optional skips.
- `npm run validate`: passed with three pre-existing evidence/sample-size warnings.
- `npm run build` and `npm run qa`: passed; QA reports warning status for expected synthetic/unverified demo metadata, with no contrast violations or unmeasured runs.
- `npm run preview`: PowerPoint 16.0 rendered all seven pages; every PNG was opened for visual inspection. Text was legible and no visible clipping or overlap was found in this demo. This is a local visual review, not an authenticated Harness approval.
- The demo's 58 audited text runs all measured successfully; the lowest contrast was 5.21:1. The separate mutated-PPTX fixture is rejected below the 4.5:1 floor.

## Scope and limits

The gate measures explicit OOXML six-digit sRGB colors, shape geometry, solid fills, and simple alpha fills composited over the known slide background. It does not calculate pixel-level contrast after complex layer blending, theme transformations, images, gradients, shadows, or rendering; does not inspect text embedded inside raster/vector images or internal chart labels; and does not decide whether a font is beautiful, sufficiently large for a room, or visually harmonious. Unsupported/inherited colors and backgrounds are reported as unmeasured and block formal structural QA. Human review of every rendered page remains necessary.
