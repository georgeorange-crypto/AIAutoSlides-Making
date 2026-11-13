# DOI full-text import via Europe PMC

Status: **implemented for a narrow open-access PMC JATS path; generic DOI resolution remains incomplete**.

`src/europepmc-ingest.mjs` accepts one DOI and requires two separate switches: `--allow-network` sends the public identifier to Europe PMC, and `--allow-download` authorizes retrieving the selected article's XML. Search results must contain exactly one matching DOI, `isOpenAccess=Y`, and a PMC identifier. Requests use the fixed `www.ebi.ac.uk` host, reject redirects, time out, and cap each response at 20 MiB. The existing output directory is never overwritten.

The importer saves source JATS XML, extracted Markdown, a manifest, and paragraph evidence with section locators and source hash. All extracted records remain `verified:false`; `reuse_rights` is `needs_review` even if a provider reports an open-access flag or license. The lightweight parser extracts paragraphs and the nearest preceding `<title>`; it does not preserve tables, figure objects, references, MathML, or all JATS hierarchy. It is not an arbitrary publisher DOI resolver, PDF importer, legal review, or science-verification service.

The provider is [Europe PMC's RESTful Web Service](https://dev.europepmc.org/RestfulWebService), which documents publication metadata and full-text access. No real request was made during this implementation; tests used mocked responses.

## Verification

- `node --test tests/europepmc-fulltext.test.mjs`: **8/8 passed** with mocked metadata/full-text responses and CLI opt-in checks.
- `npm test`: **167/167 passed**. `npm run validate`, `npm run build`, and `npm run check` completed successfully. The example validator retained three expected sample-size/unverified-evidence warnings.
- `node src/qa.mjs outputs/research-demo.pptx`: warning only; 7 text-editable slides and 1 native chart.
- `npm run preview`: PowerPoint 16.0 + Poppler 26.07.0 rendered a PDF and 7 page PNGs; all seven pages were opened and visually inspected with no apparent clipping/overlap. Human design and scientific approval remain pending.
