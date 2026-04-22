---
title: 'Tasks: Reference Extraction Pipeline'
product: platform
feature: reference-extraction-pipeline
type: tasks
status: unread
---

# Tasks: Reference Extraction Pipeline

## Pre-flight

- [ ] Confirm wp-reference-system-core has landed: `libs/aviation/src/schema/{reference,source,tags}.ts` exist, scanner at `scripts/references/scan.ts` works, base `validate.ts` runs under `bun run check`.
- [ ] Read the "The extraction pipeline" and "Source registry" sections of [20260422-reference-system-architecture.md](../../work/todos/20260422-reference-system-architecture.md).
- [ ] Decide CFR source format: eCFR bulk-download XML (default) vs PDF fallback. Document in design.md.
- [ ] Obtain one `14cfr-2026-01.xml` from the eCFR bulk-download endpoint. Note the URL for `SourceMeta.url`.
- [ ] `bun run check` passes on a fresh clone.

## Implementation

### Phase 1 - Source registry and `data/sources/` layout

- [ ] Add `data/sources/**` to `.gitignore` with allowlist exception for `*.meta.json`.
- [ ] Create `data/sources/cfr/` and drop `14cfr-2026-01.xml` in it.
- [ ] Write `data/sources/cfr/14cfr-2026-01.meta.json` with sourceId, url, format, version, downloadedAt, sha256 checksum, sizeBytes.
- [ ] Create `libs/aviation/src/sources/registry.ts`. Export `sources: Source[]` with one CFR entry pointing at the XML.
- [ ] Export `getSource(id): Source | undefined` and `getSourcesByType(type): Source[]` helpers.
- [ ] `bun run check` - 0 errors. Commit.

### Phase 2 - Extractor framework and CFR parser skeleton

- [ ] Create `libs/aviation/src/sources/cfr/parser.ts`. Function `parseCfrXml(path): CfrDocument` that reads the file once and returns an indexed structure keyed by `{title, part, section}`.
- [ ] Create `libs/aviation/src/sources/cfr/extract.ts`. Implement `SourceExtractor` interface. `canHandle(sourceId)` returns `sourceId.startsWith('cfr-')`. `extract(locator, sourceFile)` looks up the section and returns `VerbatimBlock`.
- [ ] Register the CFR extractor in a central `libs/aviation/src/sources/extractors.ts` exporting `allExtractors: SourceExtractor[]`.
- [ ] Unit-test the parser against a tiny fixture XML (one part, two sections) checked in under `libs/aviation/src/sources/cfr/__fixtures__/`.
- [ ] `bun run check` - 0 errors. `bun test` - pass. Commit.

### Phase 3 - Pipeline scripts

- [ ] Create `scripts/references/extract.ts`. Reads the manifest, dispatches to extractors, writes `libs/aviation/src/references/<type>-generated.ts`. Support `--id <ref-id>` and `--dry-run`.
- [ ] Create `scripts/references/build.ts`. Orchestrates scan (call scanner as a function) -> extract -> write. Support `--diff` (captures current generated-file contents, computes deltas, renders per-id hunks).
- [ ] Create `scripts/references/diff.ts` as a thin wrapper over `build.ts --diff --dry-run` for convenience.
- [ ] Add package scripts: `references:extract`, `references:build`, `references:diff`. Do **not** add to `dev` or `prebuild`.
- [ ] Sorted-by-id write order in generated files to keep PR diffs minimal.
- [ ] `bun run check` - 0 errors. Commit.

### Phase 4 - First 10 CFR extractions

- [ ] Add 10 `Reference` entries to the registry (hand-authored `paraphrase`, `sources[]` citing the CFR locator). Ids: `cfr-14-91-3`, `cfr-14-91-13`, `cfr-14-91-103`, `cfr-14-91-107`, `cfr-14-91-151`, `cfr-14-91-155`, `cfr-14-91-167`, `cfr-14-91-169`, `cfr-14-91-185`, `cfr-14-91-211`.
- [ ] Populate the five required tag axes for each.
- [ ] Run `bun run references:build`. Confirm `libs/aviation/src/references/cfr-generated.ts` lands with 10 entries.
- [ ] Spot-check three entries against the live eCFR web view to confirm verbatim text is intact.
- [ ] Commit the generated file.

### Phase 5 - Validator extension and refresh tooling

- [ ] Extend `scripts/references/validate.ts` with registry-coherence, meta.json-integrity, and generated-file-freshness checks (see spec.md Validation).
- [ ] Verify the new checks fire: temporarily break a `sourceId` in a reference, confirm the check fails. Revert.
- [ ] Verify meta.json integrity: bump a byte in the XML fixture, confirm checksum mismatch fails. Revert.
- [ ] Exercise `bun run references:diff`: introduce a tiny text edit to the fixture XML, re-run build, confirm the hunk renders cleanly. Revert.
- [ ] `bun run check` - 0 errors. Commit.

### Phase 6 - Size report and per-source storage decision

- [ ] Create `scripts/references/size-report.ts`. Walks `data/sources/`, tallies per type, flags LFS / external-storage candidates per the spec thresholds.
- [ ] Add package script `references:size-report`.
- [ ] Run it against the single CFR XML. Capture output.
- [ ] Present to user: commit the CFR XML to the repo, move to LFS, or keep external? Record decision in architecture doc or a follow-up ADR.
- [ ] Apply the decision (git-add the binary, configure LFS, or leave gitignored with docs on where to download).
- [ ] `bun run check` - 0 errors. Commit.

## Post-implementation

- [ ] Full manual test per test-plan.md.
- [ ] Request implementation review.
- [ ] Commit docs updates.
