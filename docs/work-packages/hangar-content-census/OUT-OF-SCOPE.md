---
id: hangar-content-census
title: Hangar Content Census -- Out of Scope
product: hangar
category: feature
status: draft
created: 2026-05-17
owner: agent
legacy_fields:
  feature: hangar-content-census
  type: out-of-scope
  review_status: pending
---

# Hangar Content Census -- Out of Scope

Rejected or deferred items, with rationale and the trigger that would revive each.
Per CLAUDE.md, this file prevents accidental rebuilds and indefinite drift.

## Editing content from the dashboard

The census is **read + plan**, not an editor. Authoring content stays in the existing
surfaces (the markdown files, the hangar glossary editor, the ingest pipeline).

- **Rationale:** an inline content editor is a large separate feature; conflating it
  with the census would balloon the WP and duplicate the existing editors.
- **Revive trigger:** if, after Phase 3, authors report that bouncing between the
  census and the editors is a real friction, propose a "quick edit intent" affordance
  as its own WP.

## Intent in a DB table

Considered and rejected. Content intent lives in git-versioned frontmatter, not a
mutable Postgres table.

- **Rationale:** intent must be versioned, reviewable in a PR, and survive a reseed --
  consistent with how ADR 025 WP frontmatter and ADRs already work. A table breaks
  all three.
- **Revive trigger:** none expected. If a future need for non-versioned, high-churn
  intent appears, it would be a deliberate ADR superseding the content-intent ADR.

## Re-rendering work-package and ADR data

The census *links to* `/platform` for WP and ADR state; it does not re-render that
data.

- **Rationale:** `hangar-platform-dashboard` owns process metadata. Two surfaces
  rendering the same WP statuses would drift.
- **Revive trigger:** none -- this is a permanent boundary.

## Auto-fixing gaps

The census surfaces gaps and links to the WP/plan that would close them. It does not
generate content, run the wx-engine, or auto-author anything.

- **Rationale:** authoring is a human-judgement act; the census informs it, doesn't
  replace it. (The truth-aware generators are a separate, deliberate capability.)
- **Revive trigger:** none.

## Historical trend / time-series

The census shows current state, not "completeness over time" charts.

- **Rationale:** trend tracking needs a snapshot store and is its own feature; Phase 1
  needs the present-state census first.
- **Revive trigger:** if, after the census is in daily use, "are we getting better or
  worse" becomes a real question, propose a snapshot-and-trend WP.

## Phase 2/3 corpora are NOT out of scope

The 13 non-wx-catalog corpora are deferred to Phase 2/3 (see [tasks.md](tasks.md)),
not out of scope. They are deliberately staged; every one will be built. Phase 1's
stub adapters are honest placeholders pending those phases, not a decision to skip
them.
