---
id: source-cache-flat-naming
title: 'Source cache flat naming'
product: platform
category: platform
status: signed-off
agent_review_status: pending
human_review_status: pending
created: 2026-04-29
owner: agent
depends_on: []
unblocks: []
tags: [sources, cache]
legacy_fields:
  feature: source-cache-flat-naming
  type: spec
---

# Spec: Source cache flat naming

One-pass migration of the developer-local source cache (`$AIRBOSS_HANDBOOK_CACHE/`) from the staged `<corpus>/<doc>/<edition>/source.<ext>` layout to a flat, self-describing scheme. Drops the redundant edition directories on AC/ACS/AIM/regs, drops the `_errata/` subdirectory on handbooks, drops the `source.<ext>` symlink machinery introduced in PR #255, and folds per-doc manifests into a single per-corpus index. Renames every file in the cache in place, updates every reader, deletes every line of compatibility code. No flags, no symlinks, no fallbacks.

## Why this WP exists

PR #255 (Apr 27) introduced descriptive filenames for new corpora (AC, ACS, AIM) but kept handbooks and regs on `source.<ext>` for backward compat with existing readers. The compat shim was a `source.<ext>` symlink alongside the descriptive filename. With handbook ingestion now landing real PDFs into the cache, the half-migrated state is generating actual ugly paths in the wild (`handbooks/phak/FAA-H-8083-25C/source.pdf`, `ac/ac-61-65-j/J/AC_61-65J.pdf`). Two of those paths are user-zero-facing (PHAK, AFH) and bleed into IDE-opened files, prompts-out artifacts, and the section-extraction tooling.

Per [feedback_no_legacy_in_airboss.md] and the project's "no `TODO(retire)`, no scheduled-cleanup cron jobs" rule: kill the half-migrated state. Pick one layout, rewrite the cache, rewrite the readers, delete the symlink module. Done in one PR.

## Anchors

- [ADR 018 -- Source artifact storage policy](../../decisions/018-source-artifact-storage-policy/decision.md). The three-tier rule (cache / inline derivatives / generated artifacts). This WP changes only the cache tier filenames.
- [ADR 020 -- Handbook edition and amendment policy](../../decisions/020-handbook-edition-and-amendment-policy.md). Errata is 1:N per handbook; multiple errata documents are an explicit design point.
- [docs/platform/STORAGE.md](../../platform/STORAGE.md). Cache layout examples must be updated in lockstep.
- PR #255 (`6b90871b`) for the staged-filename infrastructure being removed in this WP.

## In Scope

1. **Cache layout (final, flat).** Rename every file in `$AIRBOSS_HANDBOOK_CACHE/` to the layout below. Per-corpus `manifest.json` indexes; per-handbook directories preserved (because errata co-locates with the primary).

   ```text
   handbooks/<slug>/<edition>/<edition>.pdf
   handbooks/<slug>/<edition>/<edition>-errata-<errata-id>.pdf
   handbooks/<slug>/<edition>/manifest.json

   ac/<doc-id>.pdf
   ac/manifest.json

   acs/<doc-id>.pdf
   acs/manifest.json

   aim/<edition>.pdf
   aim/manifest.json

   regulations/<title>/<edition-date>.xml
   regulations/<title>/<edition-date>-parts-<filter>.xml
   regulations/<title>/manifest.json
   ```

   Concrete examples after migration:

   ```text
   handbooks/phak/FAA-H-8083-25C/FAA-H-8083-25C.pdf
   handbooks/phak/FAA-H-8083-25C/FAA-H-8083-25C-errata-mosaic.pdf
   handbooks/phak/FAA-H-8083-25C/manifest.json
   handbooks/afh/FAA-H-8083-3C/FAA-H-8083-3C.pdf
   handbooks/afh/FAA-H-8083-3C/FAA-H-8083-3C-errata-mosaic.pdf
   handbooks/afh/FAA-H-8083-3C/manifest.json
   handbooks/avwx/FAA-H-8083-28B/FAA-H-8083-28B.pdf
   handbooks/avwx/FAA-H-8083-28B/manifest.json
   # AVWX has no published errata as of 2026-04-29.

   ac/ac-61-65-j.pdf
   ac/ac-60-22.pdf
   ac/ac-91-21-1d.pdf
   ac/manifest.json

   acs/faa-s-acs-6.pdf
   acs/faa-s-acs-25.pdf
   acs/manifest.json

   aim/2026-04.pdf
   aim/manifest.json

   regulations/cfr-14/2026-04-24.xml
   regulations/cfr-14/manifest.json
   regulations/cfr-49/2026-04-24-parts-830.xml
   regulations/cfr-49/2026-04-24-parts-1552.xml
   regulations/cfr-49/manifest.json
   ```

2. **Download path rewrite.** [scripts/sources/download/plans.ts](../../../scripts/sources/download/plans.ts) emits the new `destPath` directly. Drop the `writeSourceSymlink` field from `DownloadPlan`. Drop the `'current'` synthetic edition (AC/ACS without revision letters become flat siblings, no edition dir). Drop the per-doc edition directory for AC/ACS/AIM/regs.

3. **Symlink module deleted.** [scripts/sources/download/symlink.ts](../../../scripts/sources/download/symlink.ts) and every caller. No `source.<ext>` aliases anywhere on disk.

4. **Per-corpus manifest.** Replace per-doc `manifest.json` for AC/ACS/AIM/regs with a single `<corpus>/manifest.json` indexing all docs in that corpus. Schema is an array of entries, each `{ doc_id, edition, filename, sha256, fetched_at, source_url, content_length }`. Handbooks keep a per-edition manifest at `handbooks/<slug>/<edition>/manifest.json` (co-located with the bytes, NOT at the slug level) because the edition dir already exists for errata co-location.

5. **Reader updates.** Every consumer of cached source bytes reads the manifest, not a filename convention.
   - [libs/sources/src/aim/source-ingest.ts](../../../libs/sources/src/aim/source-ingest.ts) -- drop the `source.pdf` fallback at line 105. Read manifest only.
   - [libs/sources/src/ac/ingest.ts](../../../libs/sources/src/ac/ingest.ts), [libs/sources/src/acs/ingest.ts](../../../libs/sources/src/acs/ingest.ts) -- adapt to per-corpus manifest structure.
   - [libs/sources/src/regs/cache.ts](../../../libs/sources/src/regs/cache.ts) -- adapt to flat regs layout.
   - [libs/sources/src/handbooks/](../../../libs/sources/src/handbooks/) -- handbook derivative reader switched to per-handbook manifest lookup.

6. **Python ingest updates.** [tools/handbook-ingest/ingest/fetch.py](../../../tools/handbook-ingest/ingest/fetch.py), [paths.py](../../../tools/handbook-ingest/ingest/paths.py), [cli.py](../../../tools/handbook-ingest/ingest/cli.py), [apply_errata.py](../../../tools/handbook-ingest/ingest/apply_errata.py) -- emit and read the new layout. Errata files written as `<edition>-errata-<id>.pdf` next to the primary, not under `_errata/`.

7. **One-shot cache migration script.** A throwaway script (TS or bash) that walks the existing cache, renames files in place, generates per-corpus manifests from the existing per-doc manifests, removes empty edition directories. Run once against the user's local cache. **Deleted from the repo as part of the same PR** -- per "delete the migration script when done."

8. **Download idempotency.** After migration, `bun run sources download <corpus>` detects the renamed files via HEAD-cache (existing behavior) and does NOT re-download. If a name doesn't match the new convention, the script downloads to the correct name (so a wrong-name file becomes a self-correcting case via the user's next download run).

9. **Documentation sweep.** Every doc that mentions `source.pdf`, `source.xml`, or the old layout is rewritten:
   - [docs/platform/STORAGE.md](../../platform/STORAGE.md)
   - [docs/decisions/018-source-artifact-storage-policy/decision.md](../../decisions/018-source-artifact-storage-policy/decision.md)
   - [docs/work-packages/handbook-ingestion-and-reader/spec.md](../handbook-ingestion-and-reader/spec.md) and tasks.md
   - [docs/work-packages/section-extraction-prompt-strategy/design.md](../section-extraction-prompt-strategy/design.md)
   - [docs/work-packages/apply-errata-and-afh-mosaic/design.md](../apply-errata-and-afh-mosaic/design.md)
   - [scripts/README.sources.md](../../../scripts/README.sources.md) -- delete the symlink/compat carveout entirely
   - [tools/handbook-ingest/README.md](../../../tools/handbook-ingest/README.md)

10. **ADR 021 (Source cache flat naming).** Create `docs/decisions/021-source-cache-flat-naming/decision.md` recording this layout decision, the manifest schema, and the supersedure of ADR 018's filename layout. ADR 018 receives a one-line superseded-by pointer at the top, no other rewrites (immutable-once-approved rule).

11. **Verification gate.** `bun run check` clean. `rg -n 'source\.(pdf|xml)'` returns zero hits in code, scripts, tools, and docs. `rg -n 'writeSourceSymlink|ensureSourceSymlink|_errata/'` returns zero hits. End-to-end re-run of handbook download + section extraction against the renamed cache.

## Out of Scope (explicit)

- **`.archive/` cleanups.** Pre-pivot or otherwise archived references to `source.pdf` are frozen artifacts; this WP does not touch them.
- **Inline derivatives layout.** The committed `handbooks/` tree (markdown, figure PNGs, table HTML, derivative manifest) is unchanged. This WP only touches the developer-local cache and the readers that consume it.
- **DB schema changes.** No `handbook_section`, `reference`, or related table changes. The cache rename is invisible to the DB tier.
- **Generated derivatives outside the cache.** `tools/handbook-ingest/prompts-out/` and similar generated trees follow their own naming; not part of this WP.
- **Multi-edition coexistence policy.** The cache holds one edition per slug today (handbook slugs include the edition letter). If FAA publishes a new edition, the slug changes and a new flat sibling appears. Multi-edition migration policy lives in ADR 020, not here.

## Naming rationale (decision log)

The chosen layout resolves three earlier ugly patterns observed in the staged-rollout cache.

| Pattern                                  | Why it was bad                                        | Resolution in this WP                               |
| ---------------------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| `<doc>/<edition>/source.pdf`             | Filename is non-self-describing; collides on `find`.  | Filename echoes the edition: `<edition>.pdf`.       |
| `<doc>/current/`                         | `current` is a synthetic placeholder, not an edition. | When no real edition exists, drop the dir entirely. |
| `ac/<slug>/<rev>/<filename>.pdf`         | Three levels of nesting for a flat document set.      | Flatten: `ac/<slug>.pdf`. One file per AC.          |
| `_errata/<id>.pdf` subdir                | Adds a level for files that already share a parent.   | Encode in filename: `<edition>-errata-<id>.pdf`.    |
| `source.<ext>` symlink                   | Compat shim from a staged migration that's now done.  | Delete the symlink module and every caller.         |
| Per-doc `manifest.json` for flat corpora | Many tiny files, no whole-corpus index.               | One `<corpus>/manifest.json` per flat corpus.       |

The `-errata-` infix on errata filenames is deliberate: it makes errata files self-identifying without filesystem context (`rg 'errata-'` finds them all), unambiguous about role (vs. an alt edition or chapter file), and sortable next to the primary in `ls`. Future errata documents (`FAA-H-8083-25B-errata-addendum-a.pdf`, `-addendum-b.pdf`, `-addendum-c.pdf`) follow the same shape.

AIM is the one corpus where filenames (`aim/2026-04.pdf`) are not self-describing once moved out of the parent dir. This is acceptable because AIM has exactly one document, so the parent directory IS the corpus name. The `aim-2026-04.pdf` symmetry alternative was considered and rejected as overkill -- AIM files are never moved out of `aim/` in practice.

## Acceptance criteria

- `~/Documents/airboss-handbook-cache/` matches the layout in §1 exactly. No `source.pdf`, no `source.xml`, no `_errata/`, no `current/` directories, no symlinks.
- `git grep -n 'source\.\(pdf\|xml\)'` returns zero hits in code, scripts, tools, and `docs/` (excluding `docs/.archive/`).
- `git grep -n 'writeSourceSymlink\|ensureSourceSymlink'` returns zero hits.
- `git grep -n '_errata'` returns zero hits in code/scripts/tools (docs may still discuss errata as a concept; only the directory-name string is gone).
- The migration script is not present in the repo at PR merge time.
- `bun run sources download handbooks` against the renamed cache makes zero PDF body downloads. HEAD requests are expected; the script reports every entry as cache-resolved without re-fetching the body.
- `bun run check` clean.
- A handbook section-extraction run against the renamed PHAK PDF produces semantic-equal output: same chapter count, section count, figure count, and stable section IDs. Per-section markdown bytes may differ if the derivative manifest records the source filename (verified in §I); chapter/section/figure content must not.

## Manual test plan

Per project rule, every feature is hand-tested before ship.

1. Inspect cache after migration: `tree ~/Documents/airboss-handbook-cache/ -L 4` -- confirm the layout matches §1 exactly.
2. Run `bun run sources download ac` -- expect zero downloads, all HEAD hits.
3. Run `bun run sources download handbooks --include-extras` -- expect zero downloads.
4. Run `bun run sources download regs` -- expect zero downloads.
5. Re-run handbook section extraction (existing tooling) on PHAK -- expect identical output to the pre-migration run.
6. `git grep` checks above all return clean.
7. Delete the cache and re-download fresh -- confirm the new layout is what lands, no old paths anywhere.

## Detailed punch list

This is the file:line audit the reviewer should walk through. Every item below either changes or gets deleted.

**File reference convention.** A single-line link (`file.ts#L42`) points at one statement. A range link (`file.ts#L42-L51`) points at a block where the whole block is being changed or deleted. Both are intentional and not interchangeable.

### Cache-tier vs inline-derivative-tier (important distinction)

The repo holds **two** trees with similar shapes:

- **Cache tier** (`$AIRBOSS_HANDBOOK_CACHE/`, gitignored, developer-local) -- this WP rewrites every path here.
- **Inline derivative tier** (`<repo>/ac/`, `<repo>/acs/`, `<repo>/aim/`, `<repo>/regulations/`, `<repo>/handbooks/`, committed to git) -- this WP does NOT touch.

Several `manifest.json` writers/readers operate on the derivative tier (e.g. [libs/sources/src/ac/derivative-reader.ts](../../../libs/sources/src/ac/derivative-reader.ts), [libs/sources/src/acs/derivative-reader.ts](../../../libs/sources/src/acs/derivative-reader.ts), [libs/sources/src/aim/derivative-reader.ts](../../../libs/sources/src/aim/derivative-reader.ts)). Those derivative manifests stay per-doc. Only the **cache-side** manifests collapse into per-corpus index files.

To make this unambiguous: any file path beginning with `$AIRBOSS_HANDBOOK_CACHE` or constructed via `cacheRoot()` is cache tier. Any file path beginning with `process.cwd()` or `derivativeRoot` is inline tier.

### A. Code: download path (cache writers)

| File:Line | Current | Change |
| --- | --- | --- |
| [scripts/sources/download/plans.ts:30-36](../../../scripts/sources/download/plans.ts#L30-L36) | `PdfTarget.filename` | Keep -- it's the URL filename, not the on-disk filename. |
| [scripts/sources/download/plans.ts:38-47](../../../scripts/sources/download/plans.ts#L38-L47) | `DownloadPlan` has `writeSourceSymlink: boolean` | Drop the field entirely. |
| [scripts/sources/download/plans.ts:91-92](../../../scripts/sources/download/plans.ts#L91-L92) | `mkAc` synthesizes `'current'` when no revision letter | Drop the synthetic `'current'`. All ACs go flat at `ac/<doc-id>.pdf`; the doc-id already encodes the revision letter (`ac-61-65-j`) when one exists. Plans for ACs without a revision letter set `edition: null`. |
| [scripts/sources/download/plans.ts:102-110](../../../scripts/sources/download/plans.ts#L102-L110) | `mkAcs` always sets `edition: 'current'` | All ACS plans emit `edition: null`. The manifest records `null`. Flat dest at `acs/<doc-id>.pdf`. |
| [scripts/sources/download/plans.ts:112-120](../../../scripts/sources/download/plans.ts#L112-L120) | `mkHbk` sets `edition: 'current'` | The 8 extra handbooks listed here (8083-2/9/15/16/27/30/32/34) go flat at `handbooks/<slug>/<slug>.pdf`. The slug already encodes the edition the FAA URL points at. If a future edition coexists, the slug changes. |
| [scripts/sources/download/plans.ts:139-150](../../../scripts/sources/download/plans.ts#L139-L150) | AIM plan: `aim/<edition>/aim-<edition>.pdf` + `writeSourceSymlink: true` | Flatten: `aim/<edition>.pdf`, drop `writeSourceSymlink`. |
| [scripts/sources/download/plans.ts:153-159](../../../scripts/sources/download/plans.ts#L153-L159) | AC/ACS pass `true` for symlink | Drop the boolean param entirely. |
| [scripts/sources/download/plans.ts:161-165](../../../scripts/sources/download/plans.ts#L161-L165) | Comment on handbooks compat shim | Delete the comment, the compat behavior, and the `false` arg. |
| [scripts/sources/download/plans.ts:184-201](../../../scripts/sources/download/plans.ts#L184-L201) | `buildRegsPlan`: `regulations/cfr-<title>/<edition>/<partSlug>.xml` | Flatten: `regulations/cfr-<title>/<edition>.xml` for full, `regulations/cfr-<title>/<edition>-parts-<filter>.xml` for filtered. Drop `writeSourceSymlink`. |
| [scripts/sources/download/plans.ts:211-224](../../../scripts/sources/download/plans.ts#L211-L224) | `pdfTargetToPlan(t, root, writeSourceSymlink)` returning `<corpus>/<doc>/<edition>/<filename>` | Rewrite to flat: `<corpus>/<doc-id>.pdf`. Remove the `writeSourceSymlink` parameter. Errata files for handbooks are NOT built by this function (they're written by the Python ingest). |
| [scripts/sources/download/symlink.ts](../../../scripts/sources/download/symlink.ts) | Whole module (45 lines) | **Delete.** |
| [scripts/sources/download/execute.ts:22](../../../scripts/sources/download/execute.ts#L22) | `import { ensureSourceSymlink } from './symlink';` | Delete the import. |
| [scripts/sources/download/execute.ts:52](../../../scripts/sources/download/execute.ts#L52) | `ensureSourceSymlink(plan);` after each download | Delete the call. |
| [scripts/sources/download/manifest.ts:32](../../../scripts/sources/download/manifest.ts#L32) | `join(dirname(plan.destPath), 'manifest.json')` | Rewrite to per-corpus: `join(cacheRoot, plan.corpus, 'manifest.json')` for flat corpora; for handbooks, keep alongside the doc dir. Plumbed through a new helper. |

### B. Code: cache readers (consumers)

| File:Line | Current behavior | Change |
| --- | --- | --- |
| [libs/sources/src/aim/source-ingest.ts:15](../../../libs/sources/src/aim/source-ingest.ts#L15) | Comment: `aim/<edition>/source.pdf       (or named pdf)` | Update to `aim/<edition>.pdf`. |
| [libs/sources/src/aim/source-ingest.ts:16](../../../libs/sources/src/aim/source-ingest.ts#L16) | Comment: `aim/<edition>/manifest.json` | Update to `aim/manifest.json` (per-corpus). |
| [libs/sources/src/aim/source-ingest.ts:82-92](../../../libs/sources/src/aim/source-ingest.ts#L82-L92) | Walks `<cache>/aim/<edition>/manifest.json` per edition | Walk single `<cache>/aim/manifest.json`, iterate `entries[]`, each entry has `edition` + `filename`. |
| [libs/sources/src/aim/source-ingest.ts:104-108](../../../libs/sources/src/aim/source-ingest.ts#L104-L108) | Tries `dm.source_filename` then falls back to `source.pdf` | Drop fallback. Read `entry.filename` from per-corpus manifest. Fail loudly if missing. |
| [libs/sources/src/aim/extract.ts:7](../../../libs/sources/src/aim/extract.ts#L7) | Comment references `source.pdf` | Update. |
| [libs/sources/src/ac/ingest.ts:184](../../../libs/sources/src/ac/ingest.ts#L184) | Comment: `<cache>/ac/<doc-dir>/<edition-as-on-disk>/{<filename>.pdf,manifest.json}` | Update to flat `<cache>/ac/<doc-id>.pdf` + corpus `<cache>/ac/manifest.json`. |
| [libs/sources/src/ac/ingest.ts:188](../../../libs/sources/src/ac/ingest.ts#L188) | `acRoot = join(cacheRoot, 'ac')` | Keep, but iteration changes from per-doc dir walk to per-corpus manifest read. |
| [libs/sources/src/ac/ingest.ts:199-201](../../../libs/sources/src/ac/ingest.ts#L199-L201) | Walks `<cache>/ac/<slug>/<rev>/manifest.json` | Read `<cache>/ac/manifest.json` once, iterate entries. |
| [libs/sources/src/acs/ingest.ts:18](../../../libs/sources/src/acs/ingest.ts#L18) | Comment: `<cache>/acs/<faa-doc>/<edition-on-disk>/manifest.json` | Update to `<cache>/acs/manifest.json`. |
| [libs/sources/src/acs/ingest.ts:191](../../../libs/sources/src/acs/ingest.ts#L191) | `root = join(cacheRoot, 'acs')` | Keep root, change walk strategy. |
| [libs/sources/src/acs/ingest.ts:201](../../../libs/sources/src/acs/ingest.ts#L201) | `downloaderManifestPath = join(editionPath, 'manifest.json')` | Move up: read `join(root, 'manifest.json')` once. |
| [libs/sources/src/regs/cache.ts:6](../../../libs/sources/src/regs/cache.ts#L6) | Comment: `<root>/regulations/cfr-<title>/<YYYY-MM-DD>/source.xml` | Update to `<root>/regulations/cfr-<title>/<YYYY-MM-DD>.xml`. |
| [libs/sources/src/regs/cache.ts:61](../../../libs/sources/src/regs/cache.ts#L61) | `cacheXmlPath`: returns `<root>/regulations/cfr-<title>/<editionDate>/<partSlug>.xml` | Flatten to `<root>/regulations/cfr-<title>/<editionDate>.xml` (full) or `<root>/regulations/cfr-<title>/<editionDate>-parts-<filter>.xml` (filtered). |
| [libs/sources/src/handbooks/](../../../libs/sources/src/handbooks/) | The handbook derivative reader -- need to confirm whether it reads from cache or only from inline derivatives | Audit during implementation. If it reads cache PDFs, switch to per-handbook `<cache>/handbooks/<slug>/<edition>/manifest.json` lookup. |

### C. Code: Python ingest

**Relationship to TS download path.** [scripts/sources/download/plans.ts](../../../scripts/sources/download/plans.ts) (TS, downloader) and [tools/handbook-ingest/ingest/paths.py](../../../tools/handbook-ingest/ingest/paths.py) + [fetch.py](../../../tools/handbook-ingest/ingest/fetch.py) (Python, ingester) are **independent implementations targeting the same on-disk shape**. There is no shared path-construction library and this WP does not introduce one -- the contract is the layout in §1, enforced by tests on both sides. If the layout changes again in the future, both codebases must be updated in lockstep.

| File:Line | Current | Change |
| --- | --- | --- |
| [tools/handbook-ingest/ingest/fetch.py:5](../../../tools/handbook-ingest/ingest/fetch.py#L5) | Docstring: `<doc>/<edition>/source.pdf` | Update to `<doc>/<edition>/<edition>.pdf`. |
| [tools/handbook-ingest/ingest/fetch.py:42](../../../tools/handbook-ingest/ingest/fetch.py#L42) | Docstring | Update. |
| [tools/handbook-ingest/ingest/fetch.py:51](../../../tools/handbook-ingest/ingest/fetch.py#L51) | `target = target_dir / "source.pdf"` | `target = target_dir / f"{edition}.pdf"` (need `edition` in scope -- trace from caller; it's already used to build `target_dir`). |
| [tools/handbook-ingest/ingest/paths.py:66](../../../tools/handbook-ingest/ingest/paths.py#L66) | Docstring: `Cache directory for a single (document_slug, edition) source.pdf` | Update wording. |
| [tools/handbook-ingest/ingest/cli.py:287](../../../tools/handbook-ingest/ingest/cli.py#L287) | `click.echo("  HOW:  read $AIRBOSS_HANDBOOK_CACHE/handbooks/<doc>/<edition>/source.pdf;")` | Update string. |
| [tools/handbook-ingest/ingest/apply_errata.py](../../../tools/handbook-ingest/ingest/apply_errata.py) | Builds `_errata/<id>.pdf` paths (per the work-package design.md) | Replace with `<edition>-errata-<id>.pdf` co-located with the primary. Verify no `_errata` directory is ever created. |
| [tools/handbook-ingest/tests/errata_parsers/test_bullet_edits.py:37](../../../tools/handbook-ingest/tests/errata_parsers/test_bullet_edits.py#L37) | Hardcoded `~/Documents/airboss-handbook-cache/handbooks/phak/FAA-H-8083-25C/_errata/mosaic.pdf` | Update to new path: `.../FAA-H-8083-25C/FAA-H-8083-25C-errata-mosaic.pdf`. |

### D. Tests

| File:Line | Current | Change |
| --- | --- | --- |
| [scripts/sources/download.test.ts:159](../../../scripts/sources/download.test.ts#L159) | `expect(p.writeSourceSymlink).toBe(false)` (regs) | Delete -- field is gone. |
| [scripts/sources/download.test.ts:174](../../../scripts/sources/download.test.ts#L174) | `expect(aim.writeSourceSymlink).toBe(true)` | Delete. |
| [scripts/sources/download.test.ts:182](../../../scripts/sources/download.test.ts#L182) | AC plans assert symlink true | Delete. |
| [scripts/sources/download.test.ts:183-184](../../../scripts/sources/download.test.ts#L183-L184) | Asserts AC filename ends in `.pdf` and not `source.pdf` | Replace with assertion that AC plan dest is `<root>/ac/<doc-id>.pdf` (flat). |
| [scripts/sources/download.test.ts:216-218](../../../scripts/sources/download.test.ts#L216-L218) | Handbooks asserted to end with `source.pdf` and `writeSourceSymlink === false` | Replace with assertion that handbook plan dest is `<root>/handbooks/<slug>/<edition>/<edition>.pdf`. |
| [scripts/sources/download.test.ts:391, 460](../../../scripts/sources/download.test.ts#L391) | Fallback string `'source.pdf'` in `?? 'source.pdf'` | Replace with the actual flat filename or fail-loud. |
| [libs/sources/src/bootstrap.test.ts:39](../../../libs/sources/src/bootstrap.test.ts#L39) | Test fixture `sourceUrl: \`file:///${title}/source.xml\`` | Acceptable -- this is a synthetic fixture URL, not a cache path. Audit whether the wider fixture needs the new flat path. |
| [libs/sources/src/regs/cache.test.ts:12](../../../libs/sources/src/regs/cache.test.ts#L12) | Reads `AIRBOSS_HANDBOOK_CACHE` env | Verify test expectations match new flat regs paths. |
| [libs/sources/src/ac/smoke.test.ts:59](../../../libs/sources/src/ac/smoke.test.ts#L59), [acs/smoke.test.ts:52](../../../libs/sources/src/acs/smoke.test.ts#L52) | Reads cache root and walks per-doc dirs | Update to walk per-corpus manifest. |

### E. Documentation (full sweep)

| File:Line | Action |
| --- | --- |
| [docs/platform/STORAGE.md:28](../../platform/STORAGE.md), :30, :34, :37, :75-83 | Rewrite the cache layout block. Update the `git add` walk-through. |
| [docs/ingestion-pipeline/handbook-ingestion-strategies.md:156](../../ingestion-pipeline/handbook-ingestion-strategies.md) | Update the PHAK source path. |
| [docs/decisions/018-source-artifact-storage-policy/decision.md](../../decisions/018-source-artifact-storage-policy/decision.md) | **Do NOT rewrite.** Per airboss "ADRs are immutable once approved" rule. Add a single line at the top: `> **Superseded by [ADR 021](../021-source-cache-flat-naming/decision.md) as of 2026-04-29 -- this ADR's cache filename layout is replaced; the three-tier policy (cache / inline / generated) still stands.**` Leave the rest of ADR 018 intact. |
| **NEW: [docs/decisions/021-source-cache-flat-naming/decision.md](../../decisions/021-source-cache-flat-naming/decision.md)** | **Create.** Records the flat cache decision: layout, manifest schema, deletion of the symlink shim, and the rationale for superseding ADR 018's filename layout (while preserving its three-tier policy). This ADR is a deliverable of this WP. |
| [docs/decisions/016-cert-syllabus-goal-model/decision.md:238](../../decisions/016-cert-syllabus-goal-model/decision.md) | Update path in the ingestion pipeline diagram. |
| [docs/decisions/020-handbook-edition-and-amendment-policy.md:60](../../decisions/020-handbook-edition-and-amendment-policy.md) | Update cache layout in the directory tree example. |
| [docs/work-packages/handbook-ingestion-and-reader/spec.md](../handbook-ingestion-and-reader/spec.md) lines 38, 331-336, 563 | Rewrite cache references throughout. |
| [docs/work-packages/handbook-ingestion-and-reader/tasks.md](../handbook-ingestion-and-reader/tasks.md) lines 107, 131, 193, 194 | Update task descriptions to reflect new paths. |
| [docs/work-packages/section-extraction-prompt-strategy/design.md](../section-extraction-prompt-strategy/design.md) lines 177, 206, 208, 496 | Update prompt text and verification examples. |
| [docs/work-packages/apply-errata-and-afh-mosaic/design.md](../apply-errata-and-afh-mosaic/design.md) lines 336-338 | Rewrite the errata download / cache layout section. |
| [docs/work-packages/reference-cfr-ingestion-bulk/spec.md](../reference-cfr-ingestion-bulk/spec.md) lines 54, 185, 312, 314 | Update CFR cache path references. |
| [docs/work-packages/reference-cfr-ingestion-bulk/design.md:111](../reference-cfr-ingestion-bulk/design.md) | Update. |
| [docs/work-packages/reference-cfr-ingestion-bulk/tasks.md:97](../reference-cfr-ingestion-bulk/tasks.md) | Update `cacheXmlPath` description. |
| [docs/work/plans/adr-019-rollout.md:123](../../work/plans/adr-019-rollout.md) | Update AIM cache path reference. |
| [scripts/README.sources.md](../../../scripts/README.sources.md) lines 48, 49, 51, 61 | Rewrite the cache layout table; **delete** the symlink/compat carveout paragraph entirely. |
| [tools/handbook-ingest/README.md:206](../../../tools/handbook-ingest/README.md) | Update layout block. |

### F. Per-corpus manifest schema

The collapsed `<corpus>/manifest.json` for AC/ACS/AIM and `<corpus>/<title>/manifest.json` for regs has this shape:

```typescript
interface CorpusManifest {
  schema_version: number;            // bumps when schema changes
  corpus: 'ac' | 'acs' | 'aim' | 'regs';
  generated_at: string;              // ISO 8601 UTC
  user_agent: string;                // pinned for repro
  entries: readonly CorpusManifestEntry[];
}

interface CorpusManifestEntry {
  doc_id: string;                    // e.g. 'ac-61-65-j', 'faa-s-acs-6', '2026-04', '2026-04-24'
  edition: string | null;            // 'J', '2026-04', '2026-04-24'; null for AC/ACS without revision
  filename: string;                  // relative to manifest dir, e.g. 'ac-61-65-j.pdf'
  source_url: string;
  sha256: string;
  fetched_at: string;                // ISO 8601 UTC
  content_length: number;
  etag: string | null;
  last_modified: string | null;      // HTTP Last-Modified header value
}
```

For regs, `entries[]` may include filtered variants per title; `doc_id` is the edition date and `filename` distinguishes via the `-parts-<filter>` infix.

**Write atomicity.** Per-corpus manifests are shared state across all docs in the corpus. To prevent torn writes when a download adds one entry to a 12-entry manifest:

- Read existing `<corpus>/manifest.json` if present.
- Merge the new/updated entry into `entries[]` (replace by `doc_id` + `edition` key, append if new).
- Write to `<corpus>/manifest.json.tmp`, fsync, then `rename` over the destination. POSIX rename is atomic on the same filesystem.
- A single download run is single-threaded per corpus (the existing dispatcher serializes per-corpus). Two concurrent `bun run sources download` invocations against the same corpus are not supported and never have been -- documented as such, no locking added.

For handbooks, the existing per-handbook `<cache>/handbooks/<slug>/<edition>/manifest.json` shape is kept but extended with an `errata` array:

```typescript
interface HandbookCacheManifest {
  schema_version: number;
  doc: string;                       // 'phak', 'afh', 'avwx'
  edition: string;                   // 'FAA-H-8083-25C'
  primary: HandbookCacheArtifact;
  errata: readonly HandbookErrataArtifact[];
  generated_at: string;
}

interface HandbookCacheArtifact {
  filename: string;                  // 'FAA-H-8083-25C.pdf'
  source_url: string;
  sha256: string;
  fetched_at: string;
  content_length: number;
}

interface HandbookErrataArtifact extends HandbookCacheArtifact {
  errata_id: string;                 // 'mosaic', 'addendum-a'
  // filename naming convention: '<edition>-errata-<errata_id>.pdf'
}
```

### G. One-shot migration script

A throwaway TS script -- name it `scripts/migrate-cache-flat.ts` -- runs once, then is deleted in the same PR.

Algorithm:

1. Resolve cache root via `cacheRoot()` from [scripts/lib/cache.ts](../../../scripts/lib/cache.ts).
2. For each corpus directory in `[ac, acs, aim, handbooks, regulations]`:
   - **AC, ACS:** for each `<doc>/<edition>/` subdir, `mv <doc>/<edition>/<filename>.pdf <corpus>/<doc>.pdf`. Read each per-doc `manifest.json` and append into a single `<corpus>/manifest.json` (write at the end). Delete the now-empty `<doc>/<edition>/` and `<doc>/` directories.
   - **AIM:** for each `<edition>/` subdir, `mv <edition>/aim-<edition>.pdf aim/<edition>.pdf`. Collect per-edition manifests, merge into single `aim/manifest.json`. Delete subdirs.
   - **Regulations:** for each `cfr-<title>/<edition>/` subdir, `mv <edition>/full.xml <title>/<edition>.xml`, `mv <edition>/parts-<filter>.xml <title>/<edition>-parts-<filter>.xml`. Merge per-edition manifests into `<title>/manifest.json`. Delete subdirs.
   - **Handbooks:** for each `<slug>/<edition>/` subdir:
     - `mv source.pdf <slug>/<edition>/<edition>.pdf`
     - For each `_errata/<id>.pdf`: `mv _errata/<id>.pdf <slug>/<edition>/<edition>-errata-<id>.pdf`
     - Delete the now-empty `_errata/` directory.
     - Rewrite `manifest.json` to the new `HandbookCacheManifest` shape with `primary` + `errata[]` arrays.
3. Walk the cache and assert no broken symlinks remain. Hard-error if any are found.
4. Print a summary: N files renamed, M directories removed, K manifests merged.

Idempotency rules:

- **New file already exists, old file gone:** skip silently. Migration already happened for this entry.
- **Old file exists, new file does not:** rename. Standard path.
- **Both old AND new exist** (partial run was interrupted mid-rename, or external cause): prefer the new file. Leave the old file in place as an orphan. Log a WARNING with both paths. Do NOT delete the old file -- the user inspects and decides. This rule prevents the catastrophic case where a crash-mid-rename followed by a re-run destroys the only good copy.
- **Neither exists:** log INFO ("entry missing from cache, will be re-downloaded on next `sources download`"). Do not error.

Re-runnable safely under all four cases.

The script lifecycle is two adjacent commits in the same PR:

1. **Commit A** adds `scripts/migrate-cache-flat.ts`. The user runs it once locally against their cache (interactive operator action, never invoked by CI). After the run succeeds and the cache is verified by hand, proceed to commit B.
2. **Commit B** deletes `scripts/migrate-cache-flat.ts`. The PR description explicitly notes "the migration script in commit A was a one-shot operator tool; commit B removes it now that user-zero's cache has been migrated." This is the answer to the inevitable reviewer question "why was this added and immediately deleted."

The script is never present on `main` after the PR merges. It is never run by CI. It is never run on machines other than user-zero's. It exists in git history (commit A) for one PR's worth of time and that is sufficient.

### H. Deletion checklist

When the PR closes, these things must NOT exist anywhere in the repo:

- File: `scripts/sources/download/symlink.ts`
- File: `scripts/migrate-cache-flat.ts`
- Symbol: `writeSourceSymlink` (TS field, plan property, test assertion)
- Symbol: `ensureSourceSymlink` (function, import, call)
- String: `'source.pdf'` outside of `docs/.archive/` and outside of fixture-URL test strings (audit each remaining hit)
- String: `'source.xml'` outside of `docs/.archive/`
- String: `'_errata'` (directory name) outside of `docs/.archive/`
- The literal string `'current'` as a value of `DownloadPlan.edition` or `PdfTarget.edition` in [scripts/sources/download/plans.ts](../../../scripts/sources/download/plans.ts). Verified by reading the file, not by `git grep` (which would hit unrelated `current_user`, `currentMonthEdition`, etc.). Plans emit `null` instead.
- Comment text claiming "compatibility with existing reader" or "future rename pass is mechanical" -- both lies after this WP lands.

### I. Risk register

| Risk | Mitigation |
| --- | --- |
| Section-extraction prompts hardcode `source.pdf` in the prompt body | Audit `tools/handbook-ingest/prompts-out/` for the literal string; regenerate any prompt files that bake the path. |
| Handbook derivative reader silently falls back to a missing path | Verify by `rm`'ing the cache and re-running ingest; expect a clear error, not a silent skip. |
| Two AC docs collide on flat slug (e.g. `ac-91-21-1d` and a future `ac-91-21-2d`) | Slug already includes revision letter; collisions only happen if two slugs are byte-identical, which would have collided before too. Acceptable. |
| Existing committed inline derivative manifests reference old cache paths | Inline derivative manifests record `source_url` (the FAA URL) and `source_pdf_sha256`, NOT the cache path. Verified by reading [libs/sources/src/ac/derivative-reader.ts](../../../libs/sources/src/ac/derivative-reader.ts) -- safe. |
| User has multiple cached editions of the same AC (`ac-61-65-j` AND historical `ac-61-65-i`) | Each has its own slug, so they coexist as flat siblings. No collision. |
| The `prompts-out/` tree may contain stale path strings | **Decision: dropped.** `tools/handbook-ingest/prompts-out/` IS tracked (not gitignored), but `rg -l 'source\.pdf\|_errata' tools/handbook-ingest/prompts-out/` returns zero hits as of 2026-04-29. Prompts-out files contain extraction output (chapter markdown), not cache paths. No follow-up needed. If future runs do bake cache paths into prompts, that's a separate bug to fix when it happens. |
| Migration script crashes mid-run leaves cache half-renamed | Idempotent design (§G step "if file already in new layout, skip"). User re-runs and it converges. |
| FAA URL changes happen to land during this WP | Unrelated -- FAA URL changes go through the existing `--verify` flow in [scripts/sources/download/](../../../scripts/sources/download/). This WP is pure layout. |
