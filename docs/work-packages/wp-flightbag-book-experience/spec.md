---
id: wp-flightbag-book-experience
title: "Spec: WP-FLIGHTBAG-BOOK-EXPERIENCE -- read the handbooks like books"
product: flightbag
category: feature
status: in-flight
agent_review_status: pending
human_review_status: pending
created: 2026-05-03
owner: agent
depends_on: []
unblocks: []
tags:
  - reader
  - book
legacy_fields:
  feature: wp-flightbag-book-experience
  type: spec
  review_status: done
---

<!-- Shipped in code but pending user walkthrough; transition to `status: shipped` requires user to set `human_review_status: signed-off`. -->

# WP-FLIGHTBAG-BOOK-EXPERIENCE: read the handbooks like books

Turn the flightbag from a deep-link reference reader into a place a student actually wants to sit down and read. Reading order, prev/next/up navigation, chapter preambles surfaced in flow, breadcrumbs, "you've read N of M sections," reading-time estimates -- the navigation, structure, and feel of a textbook. Foundation for the rich-reader study layer captured in [IDEAS.md](../../platform/IDEAS.md).

## Why this WP exists

The flightbag (PR #554, #567, and #560-ish round-2 in flight) is functional as a reference reader: every page has metadata, source links, figures inline, frontmatter parsed. But the user opened IFH chapter 1 and asked **"can we start building this out as pages with many sections? It should look like a book."**

The reader today is shaped like a tree -- catalog → handbook → chapter → section -- and you traverse it by clicking a node, reading its body, then back-buttoning to choose the next leaf. Books aren't shaped that way. Books have a reading order. You finish §1.1, you turn the page, you land in §1.2. You finish chapter 1, you turn the page, you land in chapter 2's preamble.

The data needed to do this is already in `study.reference_section`:

- Each section has an `ordinal` within its parent.
- Each chapter has a `section_schema` declaring depth + sequence rules.
- Reading order is implicitly defined by depth-first ordinal traversal.

We just need the reader to *use* it.

This WP also lays the substrate for the rich-reader subsystems in [IDEAS.md "Flightbag as a Rich Reading & Studying Surface"](../../platform/IDEAS.md). Read tracking, self-rated understanding, Q&A authoring, highlights, comments — none of those make sense without a reading-order model and a per-(user, section) state surface. This WP doesn't build the rich layer yet, but it puts the bones in place.

## Anchors

- [PR #554 -- flightbag reader UI](https://github.com/joshball/airboss/pull/554)
- [PR #567 -- flightbag reader round 1 (frontmatter, figures, source links)](https://github.com/joshball/airboss/pull/567)
- `fix/flightbag-reader-round-2` -- in flight (HTML tables, metadata-from-DB, chapter preamble, prev/next/empty-body nav, link-only stub UX, figure verification). Some of #1-#3 below may already be partly delivered there; revisit before scoping.
- [docs/platform/IDEAS.md "Flightbag as a Rich Reading & Studying Surface"](../../platform/IDEAS.md). The big follow-on this WP enables.
- [WP-HANDBOOK-RE-EXTRACTION-V2](../wp-handbook-re-extraction-v2/spec.md). Sibling WP fixing the data this reader presents. They can ship in parallel.
- [docs/decisions/023-flightbag-as-canonical-references-app/decision.md](../../decisions/023-flightbag-as-canonical-references-app/decision.md). The architecture ADR.

## In Scope

### 1. Reading-order model

A pure-function `getReadingOrder(referenceId)` in `libs/bc/study/src/references.ts` returns the sequence of sections in canonical reading order: front-matter → chapters in order → each chapter's preamble → each chapter's sections in ordinal order. Returns `{sectionId, code, title, depth, kind, parentChapterId, parentChapterTitle}` per entry. Cached per-reference (rebuild only when seed changes). Uses the existing `reference_section` tree; no schema changes.

`getNextInReadingOrder(sectionId)` and `getPreviousInReadingOrder(sectionId)` return the neighboring entries. `null` at boundaries.

### 2. Prev / Up / Next nav at the foot of every reader page

Every section page, every chapter page, every front-matter page gets a 3-cell navigation strip at the bottom:

```text
←  Prev: §1.0 The National Airspace System         Up to: Chapter 1: The National Airspace System         Next: §1.2 Airspace Classification  →
```

Visually: a thin border-top, three columns, prev left-aligned, up center-aligned, next right-aligned. Underline on hover. Tabbable.

Edge cases:

- First section in the doc (cover): no prev.
- Last section in the doc: no next, but optionally show a "you've reached the end" footer.
- Section without a parent chapter (e.g. a single-document doc like a SAFO): no "Up" link.

### 3. Chapter pages render preamble + section list

Already in Bucket A (round-2 PR). Restated here for completeness: chapter pages render the depth-0 chapter preamble first, then the section list.

### 4. Breadcrumbs at the top of every page

```text
Flightbag › Handbooks › Instrument Flying Handbook (FAA-H-8083-15B) › Chapter 1: The National Airspace System › §1.2 Airspace Classification
```

Each segment is a link except the current one. Same shape across all doc-types (handbook, AIM, CFR, AC, ACS) -- just different roots and segment names.

### 5. Per-handbook full TOC, always visible

A persistent left-rail or collapsible drawer that shows the entire reading order for the current doc. Sections you've read appear with a checkmark or muted styling; the current section is highlighted. The user can jump anywhere without losing their place.

This is *the* navigation aid that makes a long doc readable. Without it, the user can't jump from §3.4 to §7.1 without a five-click backtrack.

UI: collapsible left drawer (default open on desktop, default closed on mobile/tablet); width ~280px; sticky so it scrolls independently of content. Indented to match section depth.

### 6. Reading progress (read state)

A new per-(user, reference_section) read-state row -- `study.reference_section_read_state`:

- `user_id` (FK)
- `reference_section_id` (FK)
- `first_read_at`
- `last_read_at`
- `read_count` (incremented on each visit)
- `total_dwell_seconds` (heartbeat-fed)

Surfaced as:

- Checkmark in the TOC drawer for any section with `read_count > 0`
- "Read N of M sections" indicator at the top of each chapter / handbook page
- "You've read this 3 times; last on Apr 24" subtle line in the section header
- Heatmap-style overview on the doc's landing page (optional v1 polish)

The heartbeat (already prototyped in study's library reader, look for `heartbeat/+server.ts` for shape) sends pings while the user has the section open and visible. Not visible = no ping. Use the existing pattern.

### 7. Reading-time estimate per section + per chapter

`words(section_body) / 250 wpm` -> minutes. Display "≈ 4 min read" next to each section in the TOC drawer + at the top of each section page. Aggregate at the chapter and handbook level.

This is a small thing that signals "this is a book, not just a reference table" -- and it's how Medium / Substack / GitHub READMEs convey reading-time-to-commitment.

### 8. Foundation for rich-reader subsystems (data shape only)

Don't build the rich-reader features (highlights, comments, Q&A authoring) in this WP -- those are in IDEAS.md and need their own WP suite. But the schema additions in #6 use a naming convention (`study.reference_section_<feature>` per-user state) that the rich-reader follows. Document that convention in [docs/platform/STORAGE.md](../../platform/STORAGE.md) so future tables compose with this one.

## Out of Scope (explicit)

- **Rich-reader features.** Highlights, comments, Q&A authoring, self-rated understanding, public Q&A merging -- all in IDEAS.md, separately specced.
- **Cross-handbook reading paths.** "Finish PHAK chapter 1, then read AFH chapter 1" -- a curriculum thing, not a reading-order thing. Belongs to syllabi/lesson plans (cert-syllabus WP territory).
- **Annotated PDF view.** We're rendering markdown derivatives, not the PDF itself. Keep the SourceLinks "open PDF" affordance for users who want the original.

## Auth resolution

The auth-surface question that originally lived here as an open architecture question is resolved by [ADR 024 -- Cross-App Auth: Identity, Roles, Entitlements](../../decisions/024-cross-app-auth-identity-roles-entitlements.md). Summary:

- One identity realm. `@ab/auth` session cookie scoped to the parent domain (`.airboss.test` / `.airboss.com`); every app reads the same session.
- Three orthogonal layers: authentication (signed in?), roles (RBAC per ADR 009), entitlements (the new layer; what you've registered or paid for).
- Flightbag specifically: any user with the `flightbag:read` entitlement. Default-granted to every registered user. The entitlement check is what flexes when the platform later sells courses, when `flightbag:read` is bundled with paid tiers, and when flightbag eventually goes public-deploy (the route guard's check changes from "require entitlement" to "if signed in, require entitlement; else allow").

**For this WP**: phase 6 (read state) calls `requireUser(event)` + `requireEntitlement(event, 'flightbag:read')` in flightbag's `+layout.server.ts`. The `study.reference_section_read_state` row keys on the resolved `user.id`. Anonymous users (when public-deploy lands later) gracefully no-op the read-state UI -- the heartbeat / dwell-tracker / progress checkmarks just don't render.

**The entitlement primitive itself** (`identity.entitlement` table, `requireEntitlement` helper, default-grant bundles) is plumbed by ADR 024's implementation, not by this WP. If that plumbing isn't yet shipped when phase 6 begins, phase 6 ships `requireUser` only and adds the entitlement check in a follow-up commit when ADR 024's primitive lands. This sequencing prevents this WP from blocking on the auth substrate.

Phases 1-5 are stateless and run independently; no auth involvement. They can dispatch immediately when the build agent starts.

## Phases

### Phase 1: reading-order model + prev/up/next nav

`getReadingOrder` BC function + tests. Prev/up/next strip on every reader page.

### Phase 2: breadcrumbs

`<Breadcrumbs>` component in `libs/library/`. Drop into every reader page header.

### Phase 3: TOC drawer

`<TOCDrawer>` component. Collapsible, sticky. Pulled from `getReadingOrder`.

### Phase 4: chapter preamble surfacing

Already in Bucket A round-2; this WP just verifies it works for every handbook + AC.

### Phase 5: reading-time estimates

Word-count helper in `@ab/utils`. Integrate into TOC drawer + section header.

### Phase 6: read state (gated on Architecture Question)

Schema migration + heartbeat + UI surface.

## Risks

- **Reading-order is ambiguous in some docs.** AIM has paragraphs, CFR has sections-within-parts; the order isn't always linear. Each doc-type's `section_schema` declares `strict_sequence`; respect it. When `strict_sequence: false`, the prev/next nav is a best-guess.
- **TOC drawer + small viewports.** Mobile especially. Decide between a slide-over drawer (feels native) and a top-of-page collapsible (cheap). UX call.
- **Read-state migration if auth approach changes.** If we go path (a) and later switch to (c), users' read state has to migrate. Use stable user IDs and FK to whatever surfaces them.
- **Heartbeat spam at scale.** A user with 30 tabs open emits 30 heartbeats/min. Throttle client-side; debounce server-side; cap dwell at e.g. 10 min/heartbeat to avoid runaway.

## Success criteria

- A user can sit down with PHAK or IFH and read it cover-to-cover, hitting only "Next" -- no back-button gymnastics.
- The TOC drawer makes "where am I?" trivially answerable on any page.
- A user who returns next day sees their progress (3 of 11 chapters, 23 of 850 sections) without explicit save.
- Foundation for rich-reader subsystems is in place: per-(user, section) state row, conventions documented, no schema rework needed when highlights/comments/Q&A land.

## What this WP does NOT do (and what comes next)

This WP makes the flightbag *readable as a book*. The next WP suite (rich-reader, IDEAS.md) makes it *studyable as a textbook*: highlights, marginalia, Q&A authoring from a passage, public Q&A on each section, instructor comments, self-rated understanding, implicit understanding inference from card accuracy.

The two together transform the flightbag from a reference reader into the surface where the bulk of pilot ground-school happens.
