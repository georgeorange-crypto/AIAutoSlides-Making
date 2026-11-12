# Tool Adapter Contract v1

The existing catalog and `defineToolAdapter` protocol remain available. New presentation backends implement this contract through an adapter module; catalog presence alone is not evidence that an adapter works.

## Manifest

Each adapter declares `id`, `version`, `kind`, lifecycle/status, capabilities, supported platforms, input/output formats, locality/privacy/network/auth/price/terms, timeout, editability, native chart support and dependencies. Unknown license or cost metadata is reported as unknown, never guessed.

## Operations

```ts
interface PresentationAdapter {
  manifest: AdapterManifest;
  probe(context): Promise<{status:'available'|'blocked'; version?:string; reason?:string}>;
  capabilities(): Promise<AdapterCapabilities>;
  render(request: RenderRequest): Promise<AdapterResult>;
  edit?(request: SlidePatchRequest): Promise<AdapterResult>;
  export?(request: ExportRequest): Promise<AdapterResult>;
  cancel?(runId: string): Promise<{cancelled:boolean}>;
}
```

`RenderRequest` carries a validated DeckIR, explicit workspace/output path, timeout, budget and policy. `AdapterResult` carries status, adapter version, artifact paths and SHA-256 hashes, per-slide editability, warnings, logs and elapsed time. `render` must not write outside the supplied output directory. The host stages files; the adapter receives only the staged input needed for the task.

The current PptxGenJS adapter is in-process and local-only; it does not invoke paid services and does not expose hard cancellation/timeout. Its outputs are constrained to the supplied workspace, including symlink resolution checks. Future subprocess/container adapters must enforce hard timeouts at the host boundary; unsupported cancellation must not be reported as implemented.

## Execution and failure behavior

- Validate the manifest and input before invoking a backend.
- Use a per-run workspace and timeout. Network and credentials are disabled unless the run policy explicitly enables them.
- A timeout, missing executable, unsupported element or malformed output returns a typed blocked/failed result; it must not be converted into success with a raster fallback hidden from the report.
- Hash every input/output. Preserve source files; never overwrite the source deck during edit.
- Validate output schema, slide count, notes/lineage and object editability after rendering. Visual inspection and human approval are separate gates.
- Optional operations are explicit: adapters that cannot edit one slide report that limitation rather than claiming generic incremental edit support.

The first PptxGenJS IR route and the existing Slidev route are local adapters. PptxGenJS promises native text/shapes/charts only for supported mappings. Slidev reports chart/raster limitations in its manifest. Neither adapter performs research or verifies claims.
