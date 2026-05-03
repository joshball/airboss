---
title: 'Spec: WP-TOC-VALIDATION-SCHEMA -- TOC validation persistence shape'
product: hangar
feature: wp-toc-validation-schema
type: spec
status: draft
review_status: pending
---

# WP-TOC-VALIDATION-SCHEMA: TOC validation persistence shape

Define the on-disk shape for per-doc TOC validation state. Pre-work for the hangar references admin dashboard's TOC validation UI ([WP-HANGAR-REFS](../wp-hangar-references-dashboard/spec.md)). This is purely the data schema + storage layout; the UI builds on top.

## Problem

When the section-tree extraction pipeline runs against a handbook PDF, the resulting `manifest.json` has hundreds of section entries. We need a way for an admin (or the user) to:

- Walk every entry
- Confirm the rendered output matches the source PDF
- Mark each entry as validated / needs-fix / skipped
- Persist that state across sessions
- See aggregate validation status (e.g. "PHAK 850/850 verified", "RMH 12/200 verified")

Today: zero validation state. Every section is implicitly trusted.

## Where the validation manifest lives

Per-doc validation file at `validation/<corpus>/<doc>/<edition>/manifest.json`. Mirrors the source-content layout but in a separate top-level dir so it doesn't get conflated with content.

Examples:

- `validation/handbooks/phak/FAA-H-8083-25C/manifest.json`
- `validation/aim/2026-04/manifest.json`
- `validation/cfr/cfr-14/2026-04-22/manifest.json`
- `validation/ac/61-65/j/manifest.json`

This dir is committed to the repo (validation state IS content; it represents human review effort).

## Schema

```ts
export const tocValidationManifestSchema = z.object({
  schema_version: z.literal(1),
  corpus: z.string(),                       // 'handbooks', 'aim', 'cfr', 'ac', 'acs'
  document_slug: z.string(),                // 'phak', 'aim', 'cfr-14', '61-65', 'ppl-airplane'
  edition: z.string(),                      // 'FAA-H-8083-25C', '2026-04', 'j', etc.
  source_manifest_sha256: z.string(),       // sha256 of the source manifest at validation time
  last_updated_at: z.string().datetime(),
  reviewer_summary: z.object({
    total: z.number().int().nonnegative(),
    verified: z.number().int().nonnegative(),
    flagged: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
  }),
  entries: z.array(tocValidationEntrySchema),
});

export const tocValidationEntrySchema = z.object({
  // Locator into the source manifest
  section_code: z.string(),                 // '1', '1-2', '1-2-3', etc.
  body_path: z.string(),                    // matches the source manifest's body_path

  // Validation state
  status: z.enum(['pending', 'verified', 'flagged', 'skipped']),
  reviewer_id: z.string().optional(),       // who marked it
  reviewed_at: z.string().datetime().optional(),
  note: z.string().optional(),              // for flagged/skipped: the reason

  // Drift detection
  source_content_hash: z.string().optional(),  // hash of the source body at validation time
  // If the source body changes after validation, the entry status auto-resets to 'pending'
  // (the validator checks source_content_hash against the current manifest's content_hash).
});
```

## Drift detection

If a section body changes after validation (re-ingest, errata applied, etc.), the validation status is no longer trustworthy. Two options:

- (a) **Reset to pending** automatically on hash mismatch
- (b) **Mark as drifted** with a separate status; preserve the previous validation result for audit

**Recommendation: (b)**. Adds a `drifted` status. The dashboard surfaces drifted entries with a "needs re-validation" badge. Validation history is preserved (in audit log if not in the manifest itself).

## Aggregate rollup

The dashboard needs aggregate stats per corpus:

```ts
export interface CorpusValidationSummary {
  corpus: string;
  documents: number;
  total_entries: number;
  verified: number;
  flagged: number;
  skipped: number;
  pending: number;
  drifted: number;
  percent_verified: number;
}
```

Compute on-demand via aggregating the per-doc manifests. Cache in memory for the dashboard session.

## Operations

### Mark entry

```ts
function markTocEntry(args: {
  refId: SourceId;
  sectionCode: string;
  status: 'verified' | 'flagged' | 'skipped';
  note?: string;
  reviewerId: string;
}): Promise<void>
```

- Reads the validation manifest (creates if missing)
- Updates the entry by `section_code`
- Updates `last_updated_at` and `reviewer_summary` rollups
- Writes back atomically (write-if-changed)
- Audit-logs the action

### Get entry status

```ts
function getTocEntryStatus(args: { refId: SourceId; sectionCode: string }): TocValidationEntry | null
```

### Compute corpus summary

```ts
function computeCorpusValidationSummary(corpus: string): Promise<CorpusValidationSummary>
```

## Tests

- Schema parse + reject malformed
- Mark entry creates manifest, updates summary, audit-logs
- Drift detection: change source content hash → entry status flips to 'drifted'
- Atomicity: concurrent markEntry calls don't corrupt the manifest

## Out of scope

- The dashboard UI (separate WP-HANGAR-REFS)
- TOC entry hierarchy walking (the dashboard renders the tree; this schema just persists per-entry)
- Cross-doc validation (e.g. "verify all PHAK ch 2 entries at once" — UI feature, not schema)

## Anchors

- [WP-HANGAR-REFS](../wp-hangar-references-dashboard/spec.md) — the dashboard that consumes this schema
- [docs/platform/IDEAS.md](../../platform/IDEAS.md) — TOC validation UI entry
- ADR 022 (chapter-source-ingestion) — source-side manifest shape
