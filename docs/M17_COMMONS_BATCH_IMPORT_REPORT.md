# Selected Wikimedia Commons batch import

Status: **implemented as a bounded, explicit-selection batch; general media crawling remains out of scope**.

`src/asset-research.mjs download-batch` accepts a selection JSON containing `items` with a `source_id` from one saved Commons search response and a user-chosen `asset_id`. It downloads sequentially only after `--allow-download`, requires a new output directory, caps batches at five selections and 50 MiB total, and preserves per-image source page, image URL/hash, metadata hash, declared license, creator/credit and pending rights state. Only validated PNG/JPEG data from the existing Wikimedia upload host allowlist is accepted. Duplicate IDs and duplicate image bytes fail before a manifest is written. The resulting `assets.json` can be loaded by the existing asset manifest and slide builder.

No search results are downloaded automatically, no external page is crawled, and no batch can exceed the stated cap. Search/download still require separate commands and user selection. License labels and source metadata are not legal review; every downloaded asset remains `verified:false` and `rights_review_status: needs_human_review`.

Example selection file:

```json
{"items":[{"source_id":"WMC_0123456789ABCDEF","asset_id":"A_FIGURE_ONE"}]}
```

Command:

```powershell
node src/asset-research.mjs download-batch --results outputs/research/commons.json --selection outputs/research/commons-selection.json --out-dir outputs/research/commons-selected --allow-download
```

## Verification

- Focused Wikimedia Commons tests: **7/7 passed**, including selection validation, size/count caps, provenance retention, manifest loading, duplicate bytes, and disabled-by-default download behavior.
- Full `npm test`: **170/170 passed**.
- `npm run check` completed, including dependency, test, Critic evaluation, synthetic import/build and QA stages.
- `npm run preview`: PowerPoint 16.0 and Poppler 26.07.0 rendered PDF plus seven PNG pages; each page was opened and inspected with no apparent clipping or overlap. Human visual/scientific sign-off remains pending.
- No live Commons request was made; tests used mock responses. The existing single-item Commons integration remains covered.
