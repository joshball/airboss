---
title: 'Spec: WP-HANGAR-REFS -- references admin dashboard in hangar'
product: hangar
feature: hangar-references-dashboard
type: spec
status: draft
review_status: pending
---

# WP-HANGAR-REFS: references admin dashboard

Build the admin-only references dashboard inside the hangar app. Per the architecture decision in [docs/platform/REFERENCES.md](../../platform/REFERENCES.md), references admin lives in hangar (alongside content authoring + admin auth + audit log); the public reader is `apps/flightbag/`.

## Why hangar (not flightbag)

- Hangar already has admin auth (`hangar.role === 'admin'`)
- Hangar already has the audit log (every admin action is auditable)
- Hangar's mission is content-authoring + admin; references admin fits
- Flightbag stays admin-free (public reader; eventually maybe public web)

## Scope

Admin-only routes under `apps/hangar/src/routes/admin/references/`:

### `/admin/references/` — dashboard root

A table of every catalogued reference. Per row:

| Column | Source |
|--------|--------|
| Common name | `study.reference.canonical_short` + `canonical_formal` |
| Stage badge | derived: sourced / extracted / catalogued / readable / section-tree |
| Section count | `study.reference_section` rows |
| Source PDF link | from manifest's `source_url` |
| Flightbag link | `urlForReference(reference.id)` |
| Last fetched | from manifest's `fetched_at` |

Filter UI: by corpus (handbooks, AIM, CFR, AC, ACS, etc.), by stage (readable / link-only / etc.), text search.

Health checks: orphan rows (cards-without-manifests, manifests-without-cards) flagged red.

### `/admin/references/[id]/` — per-reference detail

- All metadata
- Current `body_path` + section count
- "Force re-ingest" button (admin action; logged to audit)
- "Open source PDF" / "Open in flightbag"
- Section tree preview

### `/admin/references/[id]/toc-validate/` — TOC validation page (per IDEAS.md)

3-column layout:

- TOC on left (extracted from the manifest's `sections[]`)
- System-rendered content on right (the actual rendered chunk for each entry)
- Original PDF link

Click a TOC entry → see what the system rendered for it. Keyboard shortcuts:

- `y` = mark good
- `n` = mark bad + open issue + audit log
- `s` = mark skipped + add note

Persisted as a per-doc validation manifest at `validation/<corpus>/<doc>/<edition>/manifest.json` checked into the repo.

### `/admin/references/health/` — health summary

- Count of orphan rows
- Count of manifests-without-cards
- Count of cards-without-manifests
- Count of cruft (handbooks-noningested.yaml, etc.)
- Each: linked to the rows in question

## Data contract (provided by WP-HANDBOOK-RE-EXTRACTION-V2)

WP-HANDBOOK-RE-EXTRACTION-V2 ships the substrate this dashboard reads from. Three on-disk files + one BC reader define the contract; the dashboard composes them into the warning-triage UI.

### On-disk files

| File                                                                       | Owner                              | Schema (in `libs/bc/study/src/manifest-validation.ts`) |
| -------------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| `<corpus>/<doc>/<edition>/manifest.json`                                   | extractor (re-emitted on each run) | `manifestSchema` (discriminated union on `kind`)       |
| `<corpus>/<doc>/<edition>/warnings.json`                                   | extractor (re-emitted on each run) | `handbookWarningsFileSchema`                           |
| `validation/<corpus>/<doc>/<edition>/warnings-triage.json`                 | hangar dashboard (this WP)         | `handbookWarningsTriageFileSchema`                     |

`warnings.json` carries the normalized warning list with stable 16-hex `id` per row (computed from `<code>|<section_code or "">|<message[:50]>`); the id is durable across re-extractions. `warnings-triage.json` is the human-curated companion. Both paths use the same dispatch as the BC reader: `<corpus>` is `handbooks` for handbook references, `ac` for AC references.

### Closed vocabularies

- `HANDBOOK_MANIFEST_WARNING_CODES` (in `libs/bc/study/src/manifest-validation.ts`) -- every warning code the extractor may emit.
- `WP_FIXABLE_WARNING_CODES` -- subset of fixable codes (the v2 extractor's substrate-quality target). Parser-instrumentation codes (`toc`, `toc-verify`, `llm`, `page-label`, `section-strategy`) are surfaced here for separate review but are NOT counted toward the v2 fixable queue.
- `HANDBOOK_WARNING_TRIAGE_STATUS_VALUES` -- `open` / `wontfix` / `fixed` / `duplicate`. The reader filters anything other than `open` (or untriaged) out of the dashboard's open queue.

### Single consumption point

The dashboard reads warnings exclusively through:

```ts
import { getOpenWarningsForReference } from '@ab/bc-study';
const open = await getOpenWarningsForReference(referenceId);
```

Behavior:

- Returns only warnings whose triage status is `open` (or untriaged), each with optional `triage_note` ride-along.
- Returns `[]` when `warnings.json` is absent (corpus has not been re-extracted under v2 yet, or the corpus has no warning surface).
- Throws `StaleWarningsTriageError` when the triage file's `manifest_sha256` no longer matches the live `warnings.json`. The dashboard surfaces a "manifest drift" banner and prompts re-triage rather than silently applying decisions made against an older extraction.

The reader dispatches by `reference.kind` (`handbook` / `ac` today, more corpora as they gain warning surfaces). The hangar dashboard does NOT read the on-disk JSON directly; all access goes through the BC.

### Writer side (this WP)

This WP owns the writer for `warnings-triage.json`: each triage decision in the dashboard re-writes the file in place with the latest `manifest_sha256` from the live `warnings.json`. Writes are idempotent (same decision -> identical file). Audit logging happens at the BC layer in this WP.

## BC layer

`libs/bc/hangar/src/references-admin.ts`:

- `listReferencesForAdmin(filters)` — joins `study.reference` + manifest data, computes stage
- `getReferenceDetail(id)` — full detail
- `forceReingest(id, reviewerId)` — runs the corpus-specific ingest, audit-logs
- `markTocEntry(refId, entryCode, status, reviewerId)` — TOC validation marking
- `getHealthSummary()` — orphan + cruft counts

## Auth

All routes gated by `requireHangarRole('admin')` (existing pattern).

## Tests

- BC tests for the data-shape primitives
- E2E test: admin sees the dashboard, non-admin gets 403
- E2E test: TOC validation flow (mark good, persist, refresh, see persisted state)

## Out of scope

- The flightbag app itself (separate scaffold WP)
- Cross-corpus search inside the dashboard (UI nice-to-have, deferred)
- Bulk-action API (force-reingest-many) — single action only for v1

## Phases

1. BC primitives + tests
2. Dashboard root + filters
3. Per-reference detail + force-reingest
4. TOC validation UI
5. Health summary
6. E2E tests + docs

## Anchors

- [docs/platform/REFERENCES.md](../../platform/REFERENCES.md) — architecture decision
- [docs/platform/IDEAS.md](../../platform/IDEAS.md) — entries: "Hangar references admin dashboard", "Hangar TOC validation UI"
- Existing hangar admin patterns: `/admin/audit/`, `/admin/users/` (auth + UI + BC)
