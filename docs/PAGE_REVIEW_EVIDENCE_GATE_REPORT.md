# Page-review evidence gate: verification record

## Change

Formal page review already required all 11 quality dimensions, but any nonempty note passed. The gate now requires at least 12 text units per note (Han characters or Latin words) and rejects repeated notes across dimensions on one page. This makes a one-word approval and copy/pasted checklist fail closed. It does not authenticate the reviewer or establish that a sufficiently long note is truthful or perceptive.

## Adversarial evidence

- `node --test tests/deck-gate.test.mjs` — 8 passed, 0 failed. Tests cover a complete review, missing/unresolved checks, invalid N/A, short boilerplate (`Looks good`), and a long note copied between dimensions.
- `npm test` — 338 total, 327 passed, 11 optional-dependency tests skipped, 0 failed.
- `npm run validate` — passed for the seven-slide synthetic example; three existing provenance/sample-size warnings remain visible.
- `npm run build` and `npm run qa` — produced and structurally checked the seven-slide PPTX; QA reports 7 editable text slides and 1 native chart.
- `npm run preview` — PowerPoint 16.0 rendered seven pages through Poppler 26.07.0. All seven page images were opened and inspected; no clipping or text overlap was observed in this fixture. PPTX SHA-256: `7E829FEAE2838F71C2A585A4E4E3467BBF23BE215710539A5DD9099DDC6F022D`.

## Limit

Length and uniqueness prevent empty or duplicated attestations, not dishonest or irrelevant prose. Beauty, scientific reasoning, language naturalness, and asset relevance still need a capable human reviewer. A passing review schema is not proof that the deck is good.
