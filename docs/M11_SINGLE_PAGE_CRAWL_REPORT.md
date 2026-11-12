# Phase 2 — Authorized single-page crawl slice

Status: **policy, opt-in CLI, extraction and evidence-bundle code implemented; the optional Crawl4AI runtime is not installed or end-to-end exercised in this environment**.

## Policy and behavior

`npm run research:ingest -- crawl` requires both `--allow-network` and `--site-authorized`. The CLI accepts only public HTTPS targets on the default port, checks DNS answers before the request, rejects credentials and private/reserved addresses, and rejects a final URL that changes host. Crawl4AI is configured to honor `robots.txt`; browser requests are restricted to the original HTTPS host, and the worker rechecks DNS before continuing each allowed browser request. Images, media, fonts, frames, and external-host requests are not fetched. Output contains one page, a content hash, page excerpt candidates and an explicit pending-human-review / rights-review state.

The Python policy tests cover public versus private/mixed DNS answers, same-origin HTTPS enforcement, and explicitly configured outbound gateway ranges. The JavaScript CLI tests verify default-off behavior and reject private loopback URLs before output is created.

## Verification and limits

- `npm run test` includes the crawler worker policy test when Python is present; the full test suite passed **158/158** in this workspace.
- `npm run research:ingest -- --help` runs locally. The dedicated Python policy suite also passes with Python 3.12.
- `npm run validate` passed with the existing three evidence/sample-size warnings. The default `npm run build` was blocked because its existing PPTX output was locked; building to `outputs/m11-research-demo.pptx` succeeded. PowerPoint 16.0 and Poppler rendered seven pages, all seven inspected. The existing cover title slightly crosses into the decorative right panel.
- The optional `.venv/research` runtime and Crawl4AI browser were not installed, so no real page was fetched and no robots.txt response was observed in this phase. `workers/research/install.ps1` installs the pinned `requirements-lock.txt` and matching Chromium browser into that isolated environment; run it and a separately authorized smoke test before relying on page output.
- Browser DNS validation and connection occur in separate steps, so a hostile DNS rebinding race cannot be ruled out by application-level checks alone. Do not expose this crawler to untrusted callers; deployments that need stronger isolation must enforce outbound public-only egress at the OS/container network layer.
- Fetched content remains untrusted, unverified, and subject to page-specific terms. A crawl does not establish reuse rights or scientific truth.

## Next work

Install and probe the isolated Crawl4AI runtime, exercise a controlled robots-allowed and robots-denied local test origin, and record whether the pinned 0.9.5 API behaves as expected before claiming an end-to-end crawl.
