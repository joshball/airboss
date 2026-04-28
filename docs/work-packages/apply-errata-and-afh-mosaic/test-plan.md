---
title: 'Test Plan: Apply Errata and AFH MOSAIC'
product: study
feature: apply-errata-and-afh-mosaic
type: test-plan
status: unread
---

# Test Plan: Apply Errata and AFH MOSAIC

Numbered scenarios. Prefix `ERR`. Every scenario must pass before the WP is "done."

## Setup

- [ ] Local Postgres running on port 5435 (OrbStack).
- [ ] `bun install` clean.
- [ ] Cache populated: `bun run sources download` has been run at least once.
- [ ] Schema migrated: `bun run db:migrate` clean.
- [ ] Seed loaded: Abby (`abby@airboss.test`) is the dev-seed user.
- [ ] Pre-test snapshot: `bun run sources extract handbooks afh --edition FAA-H-8083-3C --dry-run` baseline manifest captured for comparison.
- [ ] `apps/study/` dev server starts cleanly.

---

## Plugin registry (R1)

### ERR-1: Engine has no slug-keyed conditionals

1. `grep -rE "\b(if|elif).*['\"](phak|afh|avwx)['\"]" tools/handbook-ingest/ingest/ --include='*.py' | grep -v "/handbooks/"`.
2. **Expected:** zero matches outside the `handbooks/` plugin directory.

### ERR-2: Plugin registry resolves all three handbooks

1. `cd tools/handbook-ingest && source .venv/bin/activate && python -c "from ingest.handbooks import get_handbook; print(get_handbook('phak').__class__.__name__, get_handbook('afh').__class__.__name__, get_handbook('avwx').__class__.__name__)"`.
2. **Expected:** prints `PhakHandbook AfhHandbook AvwxHandbook`.

### ERR-3: Unknown slug raises typed error

1. Same Python REPL: `get_handbook('unknown-handbook')`.
2. **Expected:** raises `UnknownHandbookError` with a message listing available slugs.

### ERR-4: Re-extract is byte-stable post-refactor

1. `bun run sources extract handbooks phak --edition FAA-H-8083-25C --strategy toc`. Capture `handbooks/phak/FAA-H-8083-25C/manifest.json`.
2. Compare against the pre-refactor snapshot.
3. **Expected:** SHA-equal manifest.json. No drift.

### ERR-5: Same for AFH

1. `bun run sources extract handbooks afh --edition FAA-H-8083-3C --strategy toc`.
2. SHA-compare manifest.json against snapshot.
3. **Expected:** SHA-equal.

### ERR-6: Same for AvWX

1. `bun run sources extract handbooks avwx --edition FAA-AC-00-45H --strategy toc`.
2. SHA-compare manifest.json.
3. **Expected:** SHA-equal.

---

## Errata parser (R2)

### ERR-7: AdditiveParagraphParser parses MOSAIC AFH addendum

1. `cd tools/handbook-ingest && source .venv/bin/activate && python -m pytest tests/errata_parsers/test_additive_paragraph.py -v`.
2. **Expected:** all tests pass. Test asserts ≥4 patches found, each with non-null `chapter`, `section_anchor`, `target_page` matching `\d+-\d+` format.

### ERR-8: AdditiveParagraphParser parses MOSAIC PHAK addendum

1. Test against the cached PHAK MOSAIC PDF.
2. **Expected:** ≥3 patches found (verify chapter count against the actual PHAK MOSAIC content during pre-flight).

### ERR-9: Unknown layout raises clear error

1. Run parser against a non-MOSAIC PDF (e.g., the bound AFH PDF itself, or a constructed garbage PDF).
2. **Expected:** raises `UnknownErrataLayoutError` with a message indicating the markers it expected but did not find.

### ERR-10: YAML loader accepts new errata field

1. Load `tools/handbook-ingest/ingest/config/afh.yaml` via `config_loader.load_config('afh')`.
2. **Expected:** `config.errata` is a list with one entry; `config.errata[0].id == 'mosaic'`; `published_at == '2025-10-20'`.

### ERR-11: YAML loader is backward compatible

1. Temporarily remove the `errata:` field from `avwx.yaml` (which has no errata). Reload.
2. **Expected:** loads cleanly; `config.errata == []`.

---

## Apply pipeline (R3-R4)

### ERR-12: Schema migration applies cleanly

1. `bun run db:migrate`.
2. `psql airboss -c "\d study.handbook_section_errata"`.
3. **Expected:** table exists with columns matching design spec; `(section_id, errata_id)` unique index present.

### ERR-13: First apply writes rows and updates content

1. Apply AFH MOSAIC: `bun run sources extract handbooks afh --apply-errata mosaic`.
2. `psql airboss -c "SELECT count(*) FROM study.handbook_section_errata WHERE errata_id='mosaic'"`.
3. **Expected:** count > 0 and matches the patch count from ERR-7.
4. `psql airboss -c "SELECT content_md FROM study.handbook_section WHERE id IN (SELECT section_id FROM study.handbook_section_errata WHERE errata_id='mosaic') LIMIT 1"`.
5. **Expected:** content_md contains text from the addendum (e.g., "Light-sport Category Aircraft Maintenance").

### ERR-14: Second apply is idempotent

1. Re-run `bun run sources extract handbooks afh --apply-errata mosaic`.
2. **Expected:** exit 0, message "already applied at <ts>", no DB writes.

### ERR-15: --force re-applies cleanly

1. `bun run sources extract handbooks afh --apply-errata mosaic --force`.
2. Compare row count and content_md before/after.
3. **Expected:** row count equal (one per patch), content_md unchanged (idempotent re-write).

### ERR-16: PHAK MOSAIC apply

1. `bun run sources extract handbooks phak --apply-errata mosaic`.
2. Verify rows written and content_md updated.
3. **Expected:** count > 0; content reflects PHAK MOSAIC additions.

### ERR-17: --reapply-errata applies all known errata in published order

1. `bun run sources extract handbooks afh --reapply-errata --force`.
2. **Expected:** the manifest's `errata[]` list is iterated in `published_at` order. For AFH today, only MOSAIC; for a forward-looking test, add a second synthetic erratum to YAML with `published_at: 2025-11-01` and confirm both apply.

### ERR-18: FK cascade on section delete

1. Insert a test handbook_section, attach a fake errata row, then delete the section.
2. **Expected:** the errata row is deleted (ON DELETE CASCADE).

### ERR-19: Unique constraint on (section_id, errata_id)

1. Attempt to insert a duplicate `(section_id, errata_id)` pair manually.
2. **Expected:** unique constraint violation.

### ERR-20: Per-section errata note files exist

1. After AFH MOSAIC apply, `ls handbooks/afh/FAA-H-8083-3C/02/*.errata.md`.
2. **Expected:** ≥1 per-section errata note file. Contents include erratum id, source URL, original/replacement text.

### ERR-21: manifest.json reflects applied errata

1. `cat handbooks/afh/FAA-H-8083-3C/manifest.json | jq '.errata[]'`.
2. **Expected:** entry with `id: mosaic`, non-null `applied_at`, non-null `sha256`, `parser: additive-paragraph`, `sections_patched` is a non-empty array.

---

## Reader UI (R6)

### ERR-22: Amendment badge appears on patched section

1. Start dev server. Sign in as Abby.
2. Navigate to AFH Chapter 2 -> Preflight Assessment of the Aircraft.
3. **Expected:** "Amended" badge visible near the section title.

### ERR-23: Diff panel expands on click

1. Click the badge.
2. **Expected:** panel expands below the title showing one entry per erratum, with published date, source URL link, original/replacement text.

### ERR-24: Source URL links to FAA addendum PDF

1. Click the source URL link.
2. **Expected:** opens `https://www.faa.gov/.../AFH_Addendum_(MOSAIC).pdf` in a new tab.

### ERR-25: add_subsection patch renders as "added"

1. Find the "Light-sport Category Aircraft Maintenance" subsection (an `add_subsection` patch).
2. **Expected:** entry shows the new subsection text framed as added (no original text, just replacement).

### ERR-26: append_paragraph patch shows added paragraph

1. Find the radiator/coolant paragraph (an `append_paragraph` patch).
2. **Expected:** entry shows the added paragraph framed as appended.

### ERR-27: Sections without errata don't show the badge

1. Navigate to AFH Chapter 1 (untouched by MOSAIC).
2. **Expected:** no amendment badge.

### ERR-28: Panel is closed by default and toggles cleanly

1. Page load: panel hidden.
2. Click badge: panel visible.
3. Click badge again: panel hidden.
4. **Expected:** clean open/close, no layout shift, no console errors.

### ERR-29: PHAK MOSAIC also shows badge in reader

1. Navigate to a PHAK section patched by MOSAIC.
2. **Expected:** badge appears, panel content matches PHAK MOSAIC patches.

---

## Discovery (R7)

### ERR-30: discover-errata scans all 17 handbooks

1. `bun run sources discover-errata`.
2. **Expected:** exits 0. `<cache>/discovery/_last_run.json` exists with `handbooks_scanned: 17`. Per-handbook `<cache>/discovery/handbooks/<slug>.json` files exist.

### ERR-31: Known errata are recognized as already-applied

1. After applying MOSAIC, run `bun run sources discover-errata afh`.
2. **Expected:** the MOSAIC URL appears in `known_errata` with `status: applied`.

### ERR-32: Synthetic new candidate is flagged

1. Manually edit `<cache>/discovery/handbooks/afh.json`: remove the MOSAIC entry from `known_errata`.
2. Re-run `bun run sources discover-errata afh`.
3. **Expected:** MOSAIC URL appears in `candidates` with status `candidate`. `_pending.md` lists the candidate.

### ERR-33: Tier flagging works

1. In `_pending.md` (after a clean sweep), find a candidate for a non-ingested handbook (e.g., introduce a synthetic IFH addendum URL into the IFH state file's `candidates`).
2. **Expected:** the IFH candidate is flagged `signal-only`. AFH candidates are flagged `actionable`.

### ERR-34: Unmatched candidate is reported

1. Inject a URL into the AFH state file `candidates` that doesn't match any pattern (e.g., a random faa.gov page URL).
2. Re-run discovery.
3. **Expected:** entry appears in `_pending.md` under "unmatched" with the URL.

### ERR-35: Withdrawn URL is detected

1. Mock a 404 response for a known errata URL (or temporarily change the AFH state's known URL to a non-existent path).
2. Re-run discovery.
3. **Expected:** that URL's entry transitions to `status: withdrawn`.

### ERR-36: No GH_TOKEN -> no issue created

1. `unset GH_TOKEN; bun run sources discover-errata --dry-run`.
2. **Expected:** no GitHub API call attempted; `_pending.md` still written.

### ERR-37: With GH_TOKEN -> issue created when new candidates found

1. `export GH_TOKEN=<test token>; bun run sources discover-errata` with at least one new candidate.
2. **Expected:** issue exists in repo with label `errata`, body lists candidates with URLs.

### ERR-38: Re-run with same candidates is idempotent (no duplicate issue)

1. Re-run discovery without any state change.
2. **Expected:** no new issue created. If an existing issue is open, it is updated (or left alone) — not duplicated.

---

## Triggers (R7)

### ERR-39: Server startup runs discovery when freshness file is stale

1. Delete `<cache>/discovery/_last_run.json`.
2. Start dev server.
3. After ~10 seconds, check that `_last_run.json` exists.
4. **Expected:** server starts immediately (non-blocking); discovery runs in background; freshness file appears.

### ERR-40: Server startup skips discovery when freshness file is fresh

1. Touch `_last_run.json` to current time.
2. Restart server.
3. **Expected:** discovery does NOT run; mtime of `_last_run.json` is unchanged.

### ERR-41: bun run sources download piggyback fires discovery

1. `bun run sources download` with `_last_run.json` deleted.
2. **Expected:** discovery runs as a side effect; `_last_run.json` updated.

### ERR-42: Weekly cron installer is idempotent

1. `bash scripts/setup-discovery-cron.sh`.
2. `launchctl list | grep airboss`.
3. **Expected:** plist installed.
4. Re-run installer.
5. **Expected:** existing plist replaced, no duplicates.

### ERR-43: Dispatcher banner appears when pending items exist

1. Inject a candidate into `_pending.md`.
2. Run `bun run sources` (any subcommand).
3. **Expected:** banner appears: `[!] N unreviewed errata candidates...`.

### ERR-44: Banner suppressible

1. `AIRBOSS_QUIET=1 bun run sources`.
2. **Expected:** no banner.

---

## Edge cases

### ERR-45: Apply to a handbook with no errata in YAML fails clearly

1. `bun run sources extract handbooks avwx --apply-errata bogus`.
2. **Expected:** exits non-zero with message "no errata with id 'bogus' configured for avwx in YAML."

### ERR-46: Apply to a non-existent handbook fails clearly

1. `bun run sources extract handbooks unknown --apply-errata mosaic`.
2. **Expected:** exits non-zero with `UnknownHandbookError` message.

### ERR-47: Reader survives missing original_text

1. Manually update one errata row to `patch_kind = 'add_subsection'` with `original_text = NULL`.
2. View the section in the reader.
3. **Expected:** entry renders cleanly framed as "added" (no original column shown).

### ERR-48: Reader survives multiple errata on the same section

1. Insert a second synthetic errata row for the same section (`errata_id = 'test-future-amendment'`).
2. View the section.
3. **Expected:** panel shows two entries, newest first, both rendering correctly.

### ERR-49: Reader is performant with the badge

1. Lighthouse audit on a patched AFH section.
2. **Expected:** no regression vs an unpatched section in TBT/CLS/LCP.

### ERR-50: Discovery is resilient to network failure

1. Block faa.gov in /etc/hosts (or simulate). Run `bun run sources discover-errata`.
2. **Expected:** logs warning per failed scrape; exits non-zero (2); `_last_run.json` is NOT updated; existing state files untouched.

---

## ADR amendment (R8)

### ERR-51: ADR 020 has Revisions section dated 2026-04-28

1. Read `docs/decisions/020-handbook-edition-and-amendment-policy.md`.
2. **Expected:** "Revisions" section at end with entry dated 2026-04-28 clarifying incremental vs cumulative errata.

### ERR-52: ADR 020 line 44 wording is precise

1. Search for "cumulative" in ADR 020.
2. **Expected:** sentence reads "errata may be **incremental** ... or **cumulative** ..." (or equivalent precise wording).

---

## Final integration

### ERR-53: bun run check passes on the whole branch

1. `bun run check`.
2. **Expected:** 0 errors, 0 warnings.

### ERR-54: All tests pass

1. `bun run test`.
2. **Expected:** all unit tests pass.

### ERR-55: Playwright smoke test on patched sections

1. `bun run test:e2e -- --grep="amendment"` (write a smoke test if absent: navigate to a patched AFH section, assert badge present, click expand, assert FAA URL link present).
2. **Expected:** all pass.

### ERR-56: Visual regression: untouched sections look identical pre-WP and post-WP

1. Screenshot AFH Chapter 1 (no MOSAIC patches) before and after WP.
2. **Expected:** pixel-identical or within tolerance.
