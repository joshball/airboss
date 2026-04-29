---
title: 'ADR 021: Source cache flat naming'
date: 2026-04-29
status: accepted
participants: Joshua Ball, Claude
supersedes: 018 (cache filename layout only)
---

# ADR 021: Source cache flat naming

> Supersedes [ADR 018](../018-source-artifact-storage-policy/decision.md) **for the cache filename layout only**. ADR 018's three-tier storage policy (developer-local cache / inline derivatives / generated artifacts) is unchanged.

## Decision

The developer-local source cache uses a flat, self-describing layout. Filenames echo the doc id or edition; per-doc edition subdirectories collapse for flat corpora; per-corpus manifests replace per-doc manifests for AC, ACS, AIM, and regs.

```text
$AIRBOSS_HANDBOOK_CACHE/
  handbooks/<slug>/<edition>/<edition>.pdf
  handbooks/<slug>/<edition>/<edition>-errata-<id>.pdf
  handbooks/<slug>/<edition>/manifest.json     <- per-edition (primary + errata[])

  ac/<doc-id>.pdf                              <- one PDF per AC, flat
  ac/manifest.json                             <- per-corpus index

  acs/<doc-id>.pdf
  acs/manifest.json

  aim/<edition>.pdf
  aim/manifest.json

  regulations/cfr-<title>/<edition>.xml                       <- full title
  regulations/cfr-<title>/<edition>-parts-<filter>.xml        <- filtered
  regulations/cfr-<title>/manifest.json
```

No `source.pdf`, no `source.xml`, no `current/` synthetic edition dir, no `_errata/` subdir, no symlink shim.

## Why

PR #255 (Apr 27) introduced descriptive filenames for new corpora (AC, ACS, AIM) but left handbooks and regs on `source.<ext>` for backward compatibility, with a `source.<ext>` symlink alongside the descriptive filename to bridge the migration. With handbook ingestion now landing real PDFs, the half-migrated state was generating user-facing path strings (`handbooks/phak/FAA-H-8083-25C/source.pdf`, `ac/ac-61-65-j/J/AC_61-65J.pdf`) that bled into IDE-opened files, prompts-out artifacts, and section-extraction tooling.

Per the project's "no `TODO(retire)`, no scheduled-cleanup cron jobs" rule, the staged-migration shim was killed in one PR rather than left to drift further. This ADR records the final layout and supersedes ADR 018's filename portion.

## Layout rationale

| Pattern resolved                          | Why it was bad                                        | Resolution                                          |
| ----------------------------------------- | ----------------------------------------------------- | --------------------------------------------------- |
| `<doc>/<edition>/source.pdf`              | Filename is non-self-describing; collides on `find`.  | Filename echoes the edition: `<edition>.pdf`.       |
| `<doc>/current/`                          | `current` is a synthetic placeholder, not an edition. | When no real edition exists, drop the dir entirely. |
| `ac/<slug>/<rev>/<filename>.pdf`          | Three levels of nesting for a flat document set.      | Flatten: `ac/<slug>.pdf`. One file per AC.          |
| `_errata/<id>.pdf` subdir                 | Adds a level for files that already share a parent.   | Encode in filename: `<edition>-errata-<id>.pdf`.    |
| `source.<ext>` symlink                    | Compat shim from a staged migration that's now done.  | Delete the symlink module and every caller.         |
| Per-doc `manifest.json` for flat corpora  | Many tiny files, no whole-corpus index.               | One `<corpus>/manifest.json` per flat corpus.       |

The `-errata-` infix is deliberate: errata files are self-identifying without filesystem context (`rg 'errata-'` finds them all), unambiguous about role (vs. an alt edition or chapter file), and sortable next to the primary in `ls`. Future errata follow the same shape (`<edition>-errata-addendum-a.pdf`, etc.).

Handbook editions retain a per-edition dir because errata co-locate alongside the primary; the dir is the natural unit for "this edition + its errata + their manifest." Flat corpora (AC, ACS, AIM) do not need that grouping.

AIM is the one corpus where filenames are not fully self-describing (`aim/2026-04.pdf` doesn't carry the corpus name), but AIM has exactly one document so its parent directory IS the corpus. The `aim-2026-04.pdf` symmetry alternative was considered and rejected as overkill.

## Manifest schema

Flat corpora (AC, ACS, AIM) and regs use a per-corpus `manifest.json` with `entries[]`:

```typescript
interface CorpusManifestFile {
  schema_version: number;
  corpus: 'ac' | 'acs' | 'aim' | 'regs' | 'handbooks';
  entries: readonly ManifestEntry[];
}

interface ManifestEntry {
  corpus: 'ac' | 'acs' | 'aim' | 'regs' | 'handbooks';
  doc: string;                       // e.g. 'ac-61-65-j', 'faa-s-acs-6', '2026-04'
  edition: string | null;            // 'J', '2026-04'; null for AC/ACS without revision
  source_url: string;
  source_filename: string;           // relative to manifest dir
  source_sha256: string;
  size_bytes: number;
  fetched_at: string;                // ISO 8601 UTC
  last_modified?: string;            // HTTP Last-Modified header value
  etag?: string;
  schema_version: number;
}
```

Handbooks use a per-edition `manifest.json` with `primary` + `errata[]`:

```typescript
interface HandbookManifestFile {
  schema_version: number;
  corpus: 'handbooks';
  doc: string;                       // 'phak', 'afh', 'avwx'
  edition: string | null;            // 'FAA-H-8083-25C'
  primary: ManifestEntry;
  errata?: readonly ManifestEntry[]; // each has `source_filename: '<edition>-errata-<id>.pdf'`
}
```

## Atomicity

Per-corpus manifests are shared state across all docs in the corpus. Writes use a tmp+rename pattern: read existing manifest, merge the entry (replace by `(doc, edition)` key), write to `<path>.tmp`, `rename` over the destination. POSIX rename is atomic on the same filesystem. The downloader runs single-threaded per corpus; concurrent invocations against the same corpus are not supported.

## Migration

A one-shot TS script (`scripts/migrate-cache-flat.ts`) lands in this PR and is deleted in the same PR. The user runs it once locally to convert their existing cache; it is idempotent (re-runnable under partial-failure mid-rename) and never invoked by CI.

## Consequences

- ADR 018's filename layout is replaced. Its three-tier storage policy (cache / inline / generated) and its analysis of LFS plumbing are unchanged.
- The TS downloader (`scripts/sources/download/`) and the Python handbook ingest (`tools/handbook-ingest/ingest/`) now write the same on-disk shape but through independent implementations -- the contract is the layout above, enforced by tests on both sides.
- Cached source bytes remain gitignored; LFS plumbing in `.gitattributes` remains dormant.
- Inline derivative manifests (under `<repo>/ac/`, `<repo>/handbooks/`, etc.) record `source_url` and `source_pdf_sha256`, NOT cache paths -- so this change is invisible to the inline tier.
- Adding a new corpus is still one `.gitattributes` line + one `.gitignore` line + a cache subdirectory.

## References

- Spec: [docs/work-packages/source-cache-flat-naming/spec.md](../../work-packages/source-cache-flat-naming/spec.md)
- Superseded portion: [ADR 018 §1](../018-source-artifact-storage-policy/decision.md) (filename layout)
- Errata policy: [ADR 020 -- Handbook edition and amendment policy](../020-handbook-edition-and-amendment-policy.md)
