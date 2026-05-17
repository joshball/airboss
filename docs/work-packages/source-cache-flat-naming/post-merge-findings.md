---
title: 'Post-merge findings: cache-flat-naming migration vs PHAK errata file loss'
product: platform
feature: source-cache-flat-naming
type: post-merge-findings
status: unread
review_status: pending
---

# Post-merge findings: cache-flat-naming migration vs PHAK errata

Observed evidence the migration step (per [spec.md §G](spec.md)) may have lost the PHAK MOSAIC errata cache file during the rename pass. AFH was unaffected.

## Timeline

| When                    | Event                                             | Evidence                                                               |
| ----------------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| 2026-04-28 18:13:55 UTC | PHAK MOSAIC errata applied                        | inline manifest `applied_at`, with sha256 `1670b8454e...`              |
| 2026-04-28 18:13:55 UTC | AFH MOSAIC errata applied                         | inline manifest, sha256 recorded                                       |
| 2026-04-29 15:34 UTC    | PR #327 (cache-flat-naming) merged                | git log on main                                                        |
| 2026-04-29 ~15:35 UTC   | Operator ran `migrate-cache-flat.ts` (per WP §G)  | inferred from merge timing                                             |
| 2026-04-29 ~21:00 UTC   | First observation: PHAK errata cache file MISSING | `ls ~/Documents/airboss-handbook-cache/handbooks/phak/FAA-H-8083-25C/` |
| 2026-04-29 ~21:00 UTC   | Same observation: AFH errata cache file PRESENT   | same `ls`, AFH directory has 24 files                                  |
| 2026-04-29 21:23 UTC    | `--apply-errata mosaic` re-fetched PHAK errata    | new file timestamp; sha matches the original 2026-04-28 record         |

## What the manifest says about apply-time state

PHAK's inline manifest (`handbooks/phak/FAA-H-8083-25C/manifest.json`) carries:

```json
{
  "errata": [
    {
      "id": "mosaic",
      "source_url": "https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/PHAK_Addendum_(MOSAIC).pdf",
      "sha256": "1670b8454eb22c644a723b3f61a94daff3857c0d94710d6b5961fe29c0999b63",
      "fetched_at": "2026-04-28T18:13:55.900013+00:00",
      "applied_at": "2026-04-28T18:13:56.118948+00:00",
      ...
    }
  ]
}
```

The `sha256` is computed by `apply_errata.py:_sha256_of()` against the cached file at apply time. The file existed at apply time; the sha is identical to what we re-fetched today, which means the FAA serves the same bytes -- so we know the original cached bytes were authentic, not corrupted.

## What the migration spec said (§G)

```text
Handbooks: for each <slug>/<edition>/ subdir:
  - mv source.pdf <slug>/<edition>/<edition>.pdf
  - For each _errata/<id>.pdf: mv _errata/<id>.pdf <slug>/<edition>/<edition>-errata-<id>.pdf
  - Delete the now-empty _errata/ directory.
  - Rewrite manifest.json to the new HandbookCacheManifest shape with primary + errata[] arrays.
```

Spec is correct. If implemented as written, PHAK errata should have been renamed to the canonical post-flat path and would still be on disk today.

## Hypotheses (ranked by likelihood)

### H1: Operator script bug -- handbook-block partial implementation

The migration script was operator-written (never committed; one-shot deletion required by the WP). The operator may have implemented the AC/ACS/AIM/regs blocks, started the handbooks block, and the errata loop either:

- Never ran (nested-loop bailout)
- Ran with wrong path globs
- Encountered an error on PHAK and bailed mid-handbook

**Why PHAK-specific?** PHAK and AFH have identical pre-migration layouts. If the script processed handbooks alphabetically (afh, avwx, phak), the script may have processed AFH successfully, hit something on AVWX (no errata to migrate -- empty list?), and skipped PHAK's errata pass on a control-flow bug.

This is consistent with AFH errata being present and PHAK errata being absent.

### H2: AFH was re-applied after migration; PHAK was not

If the operator manually ran `--apply-errata mosaic --force` against AFH after the migration (perhaps as a sanity test), the apply path's `_download_errata_pdf` would have fetched from URL (since the canonical-named file was missing post-migration) and written it to the new layout. PHAK was not re-applied, so its file stayed gone.

Equivalent observation: both files were lost by migration, but AFH was the test-bed for "does --apply-errata still work?", which incidentally restored AFH's cache file.

### H3: Pre-migration state divergence

Possible but unlikely: PHAK's `_errata/mosaic.pdf` was already missing from cache before the migration script ran (deleted by some other action between apply on Apr 28 18:13 and migration on Apr 29 15:34). The migration script saw an empty `_errata/` dir for PHAK and had nothing to move. AFH's `_errata/` was full, got migrated correctly.

If this is right, the script is innocent and the gap is a separate "what deleted PHAK's errata file in the 21-hour gap" mystery.

## Severity

Low operationally. `apply_errata.py:_download_errata_pdf` is idempotent and self-healing (re-fetches when canonical-named file is missing). Running `--apply-errata <id>` against any handbook restores the file with no side effects on already-applied state. Today's invocation against PHAK demonstrated this.

But: the failure is **silent**. A future operator looking at the cache after a migration has no way to tell whether errata files were preserved, lost, or never present. The manifest claims `applied_at` whether or not the cache file is on disk.

## Recommended actions

### For future migrations (if any)

1. **Bake post-migration verification into the migration script.** After rename, walk the handbooks tree and confirm every `errata[]` entry in every per-edition manifest has a corresponding file at `<slug>/<edition>/<edition>-errata-<id>.pdf`. Hard-error and refuse to commit if any are missing.
2. **Make migration scripts checked-in code, not operator scratch.** The WP spec required the script to be deleted in commit B; this prevents future diagnosis (we couldn't read it from git). For the next migration, leave the script in `docs/.archive/migrations/<date>-<name>.ts` instead of deleting -- preserves traceability without leaving a runnable shim on main.
3. **Add a `bun run sources verify-cache` command.** Walks the cache, cross-checks every manifest entry against on-disk files, reports missing artifacts. Useful post-migration AND as a periodic sanity check.

### For operators today

Run `bun run sources extract handbooks <slug> --apply-errata <id>` for any handbook where the manifest declares errata. The apply path's idempotency guarantees no double-apply; missing cache files get refetched as a side-effect.

A one-liner check:

```bash
for slug in phak afh avwx; do
  for entry in $(jq -r '.errata[]?.id // empty' "$AIRBOSS_HANDBOOK_CACHE/handbooks/$slug/*/manifest.json" 2>/dev/null); do
    edition=$(jq -r '.edition' "$AIRBOSS_HANDBOOK_CACHE/handbooks/$slug/*/manifest.json")
    file="$AIRBOSS_HANDBOOK_CACHE/handbooks/$slug/$edition/$edition-errata-$entry.pdf"
    [ -f "$file" ] || echo "MISSING: $file"
  done
done
```

Anything reported as missing: `bun run sources extract handbooks $slug --apply-errata $entry` to repair.

## What this is NOT

- Not a regression in PR #327's TS download path. The TS downloader explicitly does not own errata fetch (per `manifest.ts` boundary docstring).
- Not a regression in `apply_errata.py`. The apply path is idempotent and self-healing; it correctly restored PHAK's file when re-invoked today.
- Not actionable without the migration script source. Without the script, we have hypotheses, not a root cause.

## Status

Filed for awareness. No fix shipped (no actionable target). Recommended actions above apply to **future** migrations, not this one. The PHAK cache state is currently consistent.
