---
title: 'Test Plan: Reference Extraction Pipeline'
product: platform
feature: reference-extraction-pipeline
type: test-plan
status: unread
---

# Test Plan: Reference Extraction Pipeline

## Setup

- wp-reference-system-core has landed; `bun run check` clean.
- `14cfr-2026-01.xml` present at `data/sources/cfr/14cfr-2026-01.xml`.
- `data/sources/cfr/14cfr-2026-01.meta.json` committed with correct sha256.
- 10 CFR references authored in the registry (phase 4 of tasks).
- All commands run from repo root.

---

## REP-1: Source registry round-trip

1. Run `bun run -e "import('./libs/aviation/src/sources/registry.ts').then(m => console.log(m.getSource('cfr-14')))"`.
2. **Expected:** Prints the CFR source record with matching path, version, checksum.

## REP-2: meta.json present for every registry entry

1. For every entry in `sources`, confirm a `*.meta.json` exists next to the path.
2. **Expected:** No missing meta files. Script: `bun run references:validate`.

## REP-3: `data/sources/**` gitignored, meta.json committed

1. `git check-ignore data/sources/cfr/14cfr-2026-01.xml`.
2. **Expected:** Path printed (ignored).
3. `git check-ignore data/sources/cfr/14cfr-2026-01.meta.json`.
4. **Expected:** Exits non-zero (not ignored).

## REP-4: Checksum mismatch fails validator

1. Append a single space to `data/sources/cfr/14cfr-2026-01.xml`.
2. Run `bun run check`.
3. **Expected:** Validator fails with "checksum mismatch for cfr-14".
4. Revert the edit.

## REP-5: Missing binary emits warning only

1. Rename `data/sources/cfr/14cfr-2026-01.xml` to `14cfr-2026-01.xml.bak`.
2. Run `bun run check`.
3. **Expected:** Check passes with a warning "source binary absent for cfr-14".
4. Revert the rename.

## REP-6: CFR parser - known section verbatim

1. Run `bun run references:extract --id cfr-14-91-155`.
2. Open `libs/aviation/src/references/cfr-generated.ts`.
3. **Expected:** Entry for `cfr-14-91-155` contains the literal opening phrase "Except as provided in Sec. 91.157, no person may operate..." (or the current 2026-01 revised wording).
4. Cross-check three other extracted sections against the live eCFR web view.

## REP-7: `build.ts` materializes all 10 CFR ids

1. Delete `libs/aviation/src/references/cfr-generated.ts`.
2. Run `bun run references:build`.
3. **Expected:** File regenerated with exactly 10 entries, sorted by id.

## REP-8: Build is idempotent

1. Run `bun run references:build` twice in a row.
2. **Expected:** Second run produces zero git diff on `cfr-generated.ts` (except `extractedAt` timestamps, which are excluded from `--diff` output).

## REP-9: `extract.ts --id` single-reference mode

1. Manually edit one entry in `cfr-generated.ts` to trivially wrong text.
2. Run `bun run references:extract --id cfr-14-91-155`.
3. **Expected:** Only that entry is replaced; other 9 unchanged.

## REP-10: Unknown sourceId fails extractor dispatch

1. Add a reference with `sources: [{ sourceId: 'made-up-source', locator: {} }]`.
2. Run `bun run references:extract`.
3. **Expected:** Process exits non-zero with "no extractor handles made-up-source".
4. Remove the bad reference.

## REP-11: Unregistered sourceId fails validator

1. Add a reference with `sources: [{ sourceId: 'cfr-15', locator: { section: '99' } }]` (cfr-15 is not registered).
2. Run `bun run check`.
3. **Expected:** Validator fails with "cfr-15 not in source registry".
4. Remove the bad reference.

## REP-12: Stale generated file warns, does not fail

1. Add a new CFR reference to the registry without running `references:extract`.
2. Run `bun run check`.
3. **Expected:** Warning "extractor has not been run for cfr-14-XXX" printed. Exit code 0.
4. Run `bun run references:extract` and confirm the warning disappears.

## REP-13: Diff tool surfaces text change

1. Record current `cfr-generated.ts` verbatim for one id.
2. Swap in a mock "next year" XML fixture with that section's text changed.
3. Update `sources/registry.ts` to point at the new fixture and bump `version`.
4. Run `bun run references:diff`.
5. **Expected:** Output shows summary "1 reference changed" with a per-id hunk of old vs new text and a `sourceVersion` transition line.
6. Revert registry and fixture.

## REP-14: Yearly-refresh end-to-end simulation

1. Prepare `14cfr-2027-01.xml` (or a minimal fixture thereof) with 91.155 text modified and 91.151 unchanged.
2. Drop it in `data/sources/cfr/`. Write its meta.json.
3. Update `registry.ts` to point at the new file with new version/checksum.
4. Run `bun run references:build --diff`.
5. **Expected:** Diff shows 91.155 changed, 91.151 unchanged; `cfr-generated.ts` is updated.
6. `git diff libs/aviation/src/references/cfr-generated.ts` shows the same change as the printed diff.

## REP-15: Build is manual, not wired into dev

1. Delete `libs/aviation/src/references/cfr-generated.ts`.
2. Run `bun run dev`.
3. **Expected:** Dev server starts. No attempt to run the extractor. (Registry lookups fall back to paraphrase-only per wp-reference-system-core's rendering layer.)
4. Run `bun run references:build` manually, confirm file returns.

## REP-16: Scanner integration (read-only)

1. Add a new `[[::cfr-14-91-3]]` wiki-link to a knowledge-graph node.
2. Run `bun run references:build`.
3. **Expected:** Build invokes scanner, manifest includes `cfr-14-91-3`, extractor runs for it, generated file contains the entry.

## REP-17: Size report output shape

1. Run `bun run references:size-report`.
2. **Expected:** Table listing per-source-type totals, per-file sizes, with a column flagging commit / LFS / external-storage recommendation per the thresholds.
3. Output is parseable enough for the user to make a per-source decision.

## REP-18: Idempotent `--id` merge preserves sort

1. Run `bun run references:extract --id cfr-14-91-3` followed by `--id cfr-14-91-211`.
2. **Expected:** Final `cfr-generated.ts` has all entries sorted alphabetically by id; no duplicates.

## REP-19: Extractor failure on one id does not block others

1. Introduce a reference with a valid sourceId but an invalid locator (e.g. `section: '9999'` that does not exist in the XML).
2. Run `bun run references:build`.
3. **Expected:** Process continues, extracts the other 10 cleanly, exits non-zero with a summary listing the failed id and its error.
4. Generated file contains the 10 good entries; the failed id is absent.

## REP-20: Fresh-clone re-hydration flow

1. On a separate checkout with `data/sources/` empty (just the committed meta.json files), run `bun run check`.
2. **Expected:** Warnings about absent binaries; no failures. Registry + checksums are intact.
3. Download the XML from the URL in the meta.json, verify sha256 matches, drop in place.
4. Re-run `bun run check`. Warnings disappear.
