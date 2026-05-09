---
title: 'Test Plan: Hangar Ingest-Review Queue'
product: hangar
feature: hangar-ingest-review-queue
type: test-plan
status: unread
review_status: pending
---

# Test Plan: Hangar Ingest-Review Queue

Three layers, each with a clear contract:

1. **Unit (Vitest).** BC logic in isolation. No DB, no filesystem, no fetches.
2. **Integration (Vitest + test DB + tmp fs).** Plugin contract end-to-end: producer writes issues, override writes round-trip to YAML, figures.py overrides loader applies them.
3. **e2e (Playwright).** Full UI walk: queue -> detail -> resolve -> sidecar exported.

A manual test plan at the bottom captures the smoke pass Joshua walks before merge per the project's "nothing merges without a manual test plan" rule.

## Unit tests (Vitest)

Targets `libs/bc/ingest-review/src/**`. Pure functions; no DB access.

### `schema.test.ts`

- [x] `ingest_issue` has the documented columns and types.
- [x] Unique index on `(kind, external_id)` is declared.
- [x] `ingest_override` cascade-deletes when its parent issue is removed.
- [x] All status / corpus / kind / action enum values match the constants exported from `@ab/constants`.

### `queries.test.ts`

- [x] `upsertIssue` with a fresh `(kind, external_id)` inserts a new row, sets `first_seen_at = last_seen_at`.
- [x] `upsertIssue` with the same key updates the payload + `last_seen_at`, leaves `first_seen_at` untouched, increments nothing else.
- [x] `applyOverride` inserts the first override, replaces it on a second call (no orphan rows).
- [x] `listIssues({ corpus, status })` filters correctly across the four status values.
- [x] `markStale(issueIds)` flips status to `stale` only for the listed ids.
- [x] `getCurrentOverride(issueId)` returns the most recent override and `null` when none exists.
- [x] Audit-log integration: every override write appends one row through the existing `libs/audit/` API.

### `plugin.test.ts`

- [x] `registerPlugin` adds to the registry; second registration with the same kind throws (no silent overwrite).
- [x] `getPlugin(kind)` returns the registered plugin or throws on unknown kind.
- [x] `listPlugins()` returns plugins in registration order (deterministic for snapshot tests).

### `producer.test.ts`

- [x] `runProducers({ corpus: 'handbook' })` invokes only handbook plugins; other corpora are skipped.
- [x] Producer output is upserted into the issue table; running twice on identical fixture is a no-op.
- [x] Producer errors are caught + logged per plugin; one failing plugin does not abort the run.

### `yaml-sidecar.test.ts`

- [x] Round-trip: serialise(parse(x)) == x for the documented YAML shape.
- [x] Parse rejects unknown action kinds with a typed error.
- [x] Parse tolerates an empty file and a file with only comments.
- [x] Serialise output is byte-stable across runs (sorted keys, single trailing newline).
- [x] Two overrides on the same issue write only the latest into YAML.

### Plugin-specific units

`plugins/handbook-caption-orphan.test.ts`

- [x] `produceIssues` over a fixture warnings.json yields one issue per `caption-without-figure` entry.
- [x] Empty warnings.json -> zero issues.
- [x] All-paired warnings.json (no caption-without-figure code) -> zero issues.
- [x] Malformed warnings.json -> typed parse error, no partial yield.
- [x] `findCandidates` for an issue on page 170 returns unpaired figures from pages 168, 169, 170, 171, 172 with their thumbnail asset paths.
- [x] `findCandidates` skips figures that already paired in the current `manifest.json`.
- [x] `applyAction('pair')` writes payload `{ image_page, image_xref }`.
- [x] `applyAction('mark-no-figure' | 'mark-false-caption')` writes empty payload.
- [x] `serializeForYaml` emits the documented sidecar shape for each action.

`plugins/handbook-image-orphan.test.ts`

- [x] Mirror of caption-orphan with the inverse action set (`pair`, `mark-extraneous`, `mark-decorative`). The fixture seeds one synthetic `figure-without-caption` since the live count is zero today.

## Integration tests

Targets the full plugin loop with a real Postgres test DB and a tmp filesystem. Single-process; one test DB per CI run via the existing test harness.

### `integration/caption-orphan-roundtrip.test.ts`

A canonical fixture (one IFH-shaped warnings.json + matching manifest.json) walks the full path:

- [x] Run producer -> issue row exists with the right payload.
- [x] `applyAction('pair', { image_xref, image_page })` -> override row exists; status flips to `resolved`.
- [x] Run export-overrides -> YAML sidecar with one entry, byte-stable.
- [x] Wipe DB, run import-overrides on the YAML -> issue + override re-created identically (modulo timestamps).
- [x] Run figures.py overrides_loader against the sidecar + the same handbook tree -> the orphaned caption is now paired. (Covered by `tools/handbook-ingest/tests/test_overrides_loader.py`.)
- [x] Re-run producer on the post-fix tree -> issue is staled (warning gone) and override survives.

### `integration/image-orphan-roundtrip.test.ts`

Mirror of caption-orphan, with the seeded synthetic image-orphan.

- [x] Producer emits the synthetic `figure-without-caption` issue.
- [x] `applyAction('pair', ...)` writes override + flips status to resolved.
- [x] YAML round-trip preserves the action + payload.
- [x] `applyAction('mark-extraneous')` resolves with empty payload.

### `integration/yaml-stability.test.ts`

- [x] export-overrides on the same DB state twice produces byte-identical files.
- [x] export-overrides on two DB states differing only by row order produces identical files (sort is deterministic).

### `integration/staleness.test.ts`

- [x] An issue resolved in a previous ingest run that disappears from the next run flips to `stale` instead of being deleted.
- [x] The override row survives staleness; re-emergence (same external_id reappears) flips status back to `unresolved` (the human re-confirms the override still applies).

## e2e (Playwright)

Targets `apps/hangar/`. Uses the seeded test user (Joshua's persona is the content-author; Abby is study-side).

### `tests/e2e/hangar-review-queue/ingest-review.spec.ts`

The spec lives under the existing `hangar-review-queue` Playwright project so the test inherits the seeded admin auth + hangar dev-server fixtures.

- [x] Hangar AUTHOR / OPERATOR / ADMIN can reach `/ingest-review` (covered by the `hangar-review-queue` project's auth gate).
- [x] Queue page renders one row per unresolved issue, grouped by corpus -> source, with a status filter chip group.
- [x] Filter by corpus = `handbook` narrows the list (sourceId narrowing is covered by the BC integration test).
- [x] Detail page renders the caption blockquote, kind label header, and the three caption-orphan action buttons.
- [x] `Mark no figure` resolves with empty-payload override.
- [x] `Dismiss` flips status to `dismissed`; `Reopen` returns to `unresolved`.
- [x] "View page N in PDF" link renders without erroring (the actual `file://` href depends on cache-root presence in the e2e env).

`Pair` against a real candidate thumbnail is exercised by the BC integration test (`integration/caption-orphan-roundtrip.test.ts`) where the figure asset path resolves against a tmp `handbooks/` tree. The e2e spec covers the auth + routing + form-action contract; the BC test covers the candidate-strip data flow.

## Manual test plan

Walked by Joshua before merge. Reproduces the "real-world" loop the unit + integration tests can only sample.

### Pre-flight

- [ ] DB is up (`bun run db status`).
- [ ] Cache root exists with IFH PDF: `~/Documents/airboss-handbook-cache/handbooks/ifh/FAA-H-8083-15B/FAA-H-8083-15B.pdf`.
- [ ] Hangar app is running locally (`bun run dev`); auth as AUTHOR-or-higher role.

### Walk

1. Open `/ingest-review`. Confirm the IFH section shows 21 caption-orphans (or whatever the live count is at merge time -- check `bun tools/handbook-ingest/bin/orphan_report.py` first).
2. Pick one issue (e.g. `Caption Figure 4-7. Koch chart sample.` on page 83). Confirm the page loads in under 1 second.
3. The thumbnail strip shows at least one candidate from pages 81-85 with dimensions.
4. Click the candidate that matches the caption visually. Click `Pair`.
5. Issue redirects to queue; row is now in the resolved section.
6. Repeat for at least three more IFH issues to exercise the action set:

   - One `Pair` against an obvious match.
   - One `Mark no figure` against a sub-figure header (e.g. a caption that introduces a multi-panel figure).
   - One `Mark false caption` against any residual sentence reference (if any survive the regex).

7. Click "View page N in PDF" on any issue. Confirm the OS PDF viewer opens to the right page.
8. Run `bun scripts/ingest-review/export-overrides.ts --corpus handbook --source ifh`.
9. Open `scripts/sources/config/handbooks/ifh-overrides.yaml`. Verify the four entries you authored are listed in stable order with the expected payload.
10. Run `bun scripts/sources/handbooks ingest --slug ifh --re-extract` (or the equivalent re-extract command).
11. Run `bun tools/handbook-ingest/bin/orphan_report.py`. Confirm IFH's `caption-without-figure` count dropped by 4.
12. In the hangar UI, the four resolved issues now show `resolved (sidecar applied)` -- the producer re-confirmed them against the post-fix manifest.
13. Wipe local DB tables (`hangar.ingest_issue`, `hangar.ingest_override`), run `bun scripts/ingest-review/import-overrides.ts`. Confirm the four issues + overrides are restored from YAML.

### Smoke

- [ ] No console errors in the browser during any step.
- [ ] No `process is not defined` / `Buffer is not defined` from any hangar route (per the [browser-hydration playbook](../../agents/debug-playbooks/browser-hydration.md)).
- [ ] `bun run check` clean against the post-merge branch.
- [ ] Audit-log shows one entry per action click.
