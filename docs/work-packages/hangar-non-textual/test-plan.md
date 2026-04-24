---
title: 'Test plan: Hangar non-textual sources'
product: hangar
feature: hangar-non-textual
type: test-plan
status: unread
review_status: done
---

# Test plan: Hangar non-textual sources

## Automated

### Unit

- [ ] `resolveCurrentSectionalEdition` parses the committed `aeronav-index.html` fixture and returns the expected `{ effectiveDate, editionNumber, resolvedUrl }`
- [ ] Resolver throws a clear error on missing selector
- [ ] Resolver throws a clear error on no region-matching link
- [ ] Resolver throws a clear error on unparseable date
- [ ] `generateSectionalThumbnail` against `tiny-chart.zip` fixture produces a JPEG under `SECTIONAL_THUMBNAIL.MAX_BYTES` with the expected dimensions
- [ ] Generator steps JPEG quality down until under budget; throws when `MIN_QUALITY` reached and still over
- [ ] Generator throws `no-tool-available` with install hint when both `gdal_translate` and `sips` are absent (mocked)
- [ ] Round-trip a sectional `Source` through `toml-codec`: byte-identical
- [ ] Fetch handler binary-visual branch: happy path updates DB row with new `media` + `edition` + `checksum`
- [ ] Fetch handler: no-change path (same edition, same sha) short-circuits without writing a new archive
- [ ] Fetch handler: edition-drift (same edition date, different sha) fails with structured error; DB row not mutated
- [ ] New-source form Zod schema: rejects missing `region` + missing `index_url` when kind is `binary-visual`
- [ ] `scripts/references/extract.ts` early-returns for sectional sources with a clear "not applicable" log
- [ ] Same early-return for `scan`, `validate`, `build`, `diff`

### Integration

- [ ] Full fetch job against a local HTTP mock serving `tiny-chart.zip`: `hangar.source` updated, `meta.json` written to disk, thumbnail file present, `hangar.job_log` contains the full event sequence
- [ ] Edition rotation: first fetch at edition E1, second fetch at edition E2 (resolver returns a newer date); E1 directory archived, E2 directory populated, archive retention respected
- [ ] Audit rows written for: edition resolved, thumbnail generated, fetch complete

## Manual walkthrough

Run in order on dev (`bun run dev hangar`). Each step has a pass condition.

### Seed

1. Log into hangar. Navigate to `/glossary/sources/new`. **Pass:** form renders.
2. Pick type `VFR Sectional`. **Pass:** the "Non-textual details" panel reveals; cadence defaults to 56.
3. Fill: id `sectional-denver`, title `Denver VFR Sectional Chart`, region `Denver`, index URL `https://aeronav.faa.gov/visual/`, URL template `https://aeronav.faa.gov/visual/{edition-date}/sectional-files/{region}.zip`. Submit. **Pass:** redirected to `/glossary/sources/sectional-denver`; row is dirty; no sync yet.
4. Click "Sync all pending". **Pass:** `/jobs/[id]` loads; sync job completes; `libs/db/seed/sources.toml` contains the new entry (verify with `git diff`); commit lands (local-commit mode) or PR opens (PR mode).

### First fetch

5. Navigate to `/sources/sectional-denver`. **Pass:** page renders with state `pending download`; no preview tile yet.
6. Click `Fetch`. **Pass:** redirect to `/jobs/[id]`; log streams `edition resolved -> download -> archive -> thumbnail -> meta.json -> update`.
7. Job completes. **Pass:** `hangar.source` row shows `checksum`, `size_bytes`, `media.thumbnailPath`, `media.archiveEntries`, `edition.effectiveDate`, `edition.resolvedUrl` all populated.
8. `ls data/sources/sectional/sectional-denver/<edition>/`. **Pass:** contains `chart.zip`, `thumb.jpg`, `meta.json`.
9. `cat data/sources/sectional/sectional-denver/<edition>/meta.json`. **Pass:** sha256 + sizeBytes + edition details + thumbnail info all present.
10. Reload `/sources/sectional-denver`. **Pass:** preview tile renders with the thumbnail inline; metadata stack shows edition + archive size + downloaded-at + generator; alt-text describes the edition.

### Preview + files browser

11. Inspect the preview tile DOM. **Pass:** no hex / rgb / hsl in inline styles; every color resolves to a `--*` token.
12. Click the thumbnail. **Pass:** archive download starts (content-disposition: attachment).
13. Navigate to `/sources/sectional-denver/files`. **Pass:** shows `chart.zip`, `thumb.jpg`, `meta.json`.
14. Click `chart.zip`. **Pass:** `ZipPreview` renders the archive manifest (entries + sizes) without extracting.
15. Click `thumb.jpg`. **Pass:** `JpegPreview` renders the image inline with a role-token frame.
16. Click `meta.json`. **Pass:** `JsonPreview` (from WP3) pretty-prints.

### Re-fetch (no change)

17. Click `Fetch` again immediately. **Pass:** job completes quickly; log contains `no change (edition + bytes match)`; `hangar.source` untouched; no new directory created.

### Re-fetch (next edition)

18. Inject a "next edition" via the resolver override (environment flag or admin tool; see Phase 6 in tasks.md) so the resolver returns a newer effective date.
19. Click `Fetch`. **Pass:** job runs end to end; new directory `data/sources/sectional/sectional-denver/<new-edition>/` populated; old directory renamed to `<old-edition>@archived-<ts>`; previous thumbnail preserved.
20. `/sources/sectional-denver` preview tile now shows the new edition's thumbnail + metadata.
21. Verify archive retention: run `Fetch` enough times (with different simulated editions) to exceed `ARCHIVE_RETENTION`. **Pass:** oldest archived directory is pruned.

### Edition drift

22. Manually edit `data/sources/sectional/sectional-denver/<edition>/meta.json` to record a different sha256 than the file's actual sha. Click `Fetch`. **Pass:** job fails with `edition-drift`; both sha values appear in the log; `hangar.source` row untouched.

### Extraction is a no-op

23. Run `bun run references extract --id sectional-denver` in a terminal. **Pass:** prints `binary-visual source, skipping extraction (not applicable)`; exit code 0.
24. Same for `scan`, `validate`, `build`, `diff`. **Pass:** each prints the "not applicable" message.
25. From the hangar UI, click `Extract` on the sectional detail page (if the action is exposed). **Pass:** job completes with the same "not applicable" log; no `*-generated.ts` touched.

### Concurrency

26. Open two browser windows, log in as two users. Both trigger `Fetch` on `sectional-denver`. **Pass:** second fetch queues until first finishes; `/jobs` shows the serialisation.
27. When plates or airport diagrams land later, the same pattern will serialise per-id but parallelise across ids. Not tested here (no second binary-visual source registered).

### Theme invariants

28. Toggle appearance (light/dark) on `/sources/sectional-denver` and `/sources/sectional-denver/files`. **Pass:** every element re-renders without flicker; contrast holds.
29. Run the token-enforcement lint from [theme-system/03-ENFORCEMENT.md](../../platform/theme-system/03-ENFORCEMENT.md). **Pass:** zero violations in any file this WP touched.
30. Run the contrast test suite. **Pass:** every new role-pair combination hits WCAG AA in both appearances.
31. Disable JS, reload `/sources/sectional-denver`. **Pass:** first paint already has the correct appearance (no FOUC).

### Audit completeness

32. `select * from audit.event where target_type like 'hangar.source.%' order by at desc limit 20` after the above steps. **Pass:** rows for fetch, edition resolved, thumbnail generated, edition-drift (if step 22 ran), new-source create, sync-to-disk. Every row has actor + target + metadata.

### Tool detection on a fresh machine

33. Rename or uninstall `gdal_translate` and `sips` (or simulate via PATH manipulation in a subshell). Click `Fetch`. **Pass:** job fails with `no thumbnail generator available on PATH; install gdal or run on macOS`.

## Review

- [ ] Self-review + `/ball-review-full`
- [ ] Spec drift check: does `spec.md` still match the shipped code? Update if not.
- [ ] Work package doc review: `status: done`, `review_status: done` set only after manual walkthrough passes + all automated tests green.
