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
