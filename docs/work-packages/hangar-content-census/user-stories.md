---
id: hangar-content-census
title: Hangar Content Census -- User Stories
product: hangar
category: feature
status: draft
created: 2026-05-17
owner: agent
legacy_fields:
  feature: hangar-content-census
  type: user-stories
  review_status: pending
---

# Hangar Content Census -- User Stories

The user is Joshua -- content author, platform owner, and the pilot the platform is
built around. "Author" below means him in his content-authoring role.

## Census overview

**As an author deciding where to spend a session,** I want one page that lists every
content corpus with its size and health, so I can see the whole platform's content
state without running scripts or opening 14 directories.

**As an author,** I want each corpus's health to be a labelled, explained signal --
not a bare colour -- so I know *why* something is flagged, not just *that* it is.

## Per-corpus drill-down

**As an author looking at the wx catalog,** I want a page that shows what exists, what's
missing, and what to do next, with every number explained, so I understand that
"20/155" means generator coverage (not catalog quality) and I know the next action is
an AIRMET emitter.

**As an author,** I want every corpus page to link to the ADRs, plans, and source
files that govern it, so I can go from "this looks thin" to the actual decision
record in two clicks.

**As an author,** I want a per-corpus "next" list ranked by value, each item linking
to the WP or plan that delivers it, so "what should I build next" has a concrete,
clickable answer.

## Intent capture

**As an author,** I want to record planned and wanted work against a specific content
item -- in the item's own file, versioned in git -- so my intent doesn't drift from
the content and doesn't vanish on a DB reseed.

**As an author,** I want a content item with no captured intent to *show* as "no plan
captured," so the absence of a plan is itself visible and triageable.

## Teaching, not just reporting

**As anyone landing on a census page with no prior context,** I want every metric to
tell me what it measures, why it matters, and what to do about it, so the dashboard
teaches me the platform's content model rather than assuming I already know it.

## Breadth-first delivery

**As the platform owner,** I want the first release to show all 14 corpora even though
only one has a full drill-down, so the complete scope is visible immediately and the
remaining corpora are honestly marked "pending" rather than hidden.
