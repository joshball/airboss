---
title: 'Out of Scope: Card Page and Cross-References'
product: study
feature: card-page-and-cross-references
type: out-of-scope
status: unread
---

# Out of Scope: Card Page and Cross-References

Deferred items, why they're deferred, and the trigger that should make us revisit each. Future agents and humans: do not build these without the documented trigger. If you think the trigger is hit, surface it for a decision rather than building silently.

## Summary

| Item                                             | Status       | Trigger to revisit                                                                  |
| ------------------------------------------------ | ------------ | ----------------------------------------------------------------------------------- |
| "Review this card now" single-card button        | Rejected     | Never -- see detail below                                                           |
| Authoring citations from the card surface        | Follow-on WP | Lives in the `content-citations` WP; this WP only reads its output                  |
| Plan-to-card enrollment UI                       | Deferred     | When plan-to-card enrollment becomes a learner-facing feature                       |
| Public card comments, likes, or feedback         | Deferred     | When a user-zero-validated reason for public engagement on a single card emerges    |
| Reps-to-card enrollment populating cross-ref row | Deferred     | When reps gain a first-class card-citation linkage                                  |
| Scenario cross-ref row populating from citations | Deferred     | When the `content-citations` WP lands and scenario citations exist                  |
| Course-source label on the public card page      | Deferred     | When the first course-source card needs to surface its source label publicly        |
| OpenGraph tags on the public card page           | Deferred     | When a learner first shares a `/cards/<id>` URL on a platform that renders previews |
| Denormalize session-count onto `card_state`      | Deferred     | When the live `session_item_result` join is shown to be slow                        |

## "Review this card now" single-card button

Status: Rejected

What was rejected:
A button on `/memory/<id>` that immediately starts reviewing the single card outside of a real session, per the original SMI walkthrough item 4 ask.

Why:
Single-card review outside of a real session would either bypass FSRS scheduling (poisoning the spaced-rep model) or require inventing a fake session (introducing a second session shape with weaker semantics than the real one). Neither tradeoff is worth the payoff. The locked decision per [spec.md](spec.md) Out of scope section is "dropped, not replaced."

Trigger to revisit:
Never -- unless a future change to FSRS or session modelling makes single-card review possible without scheduling pollution. Re-decision would require evidence that the FSRS-poison risk is gone.

References:

- [spec.md](spec.md) Out of scope section
- [spec.md](spec.md) Why section -- references SMI walkthrough item 4
- `docs/work/.archive/todos/20260424-02-smi-walkthrough-feedback.md` item 4

## Authoring citations from the card surface

Status: Follow-on WP

What was deferred:
The authoring path for citations rendered on the public card page. This WP only reads citations once they exist; the authoring UI lives in the separate `content-citations` WP.

Why:
Card-page and content-citations are independently scoped. Bundling authoring into this WP would couple two shipping cadences and bloat the surface.

Trigger to revisit:
N/A -- this is a routing decision, not a deferral. The `content-citations` WP owns authoring; this WP renders its output.

Implementation pattern when triggered:
Coordinate with the `content-citations` WP at `docs/work-packages/content-citations/spec.md`. When citations exist, `getPublicCard` already returns `citations[]` for render on the public page; no additional work on this WP is needed.

References:

- [spec.md](spec.md) Out of scope section
- [docs/work-packages/content-citations/spec.md](../content-citations/spec.md)

## Plan-to-card enrollment UI

Status: Deferred

What was deferred:
A surface that lets the learner enroll a card into a study plan, or a UI that shows the plans a card belongs to with edit controls. This WP only renders a read-only Plans row on the Cross-references panel; the row shows "not available yet" until enrollment data lands.

Why:
Plan-to-card enrollment data does not exist today. The cross-references read path is in scope; the enrollment write path is not.

Trigger to revisit:
When plan-to-card enrollment becomes a learner-facing feature (i.e., when plans gain a card-membership table or column and a corresponding write API).

Implementation pattern when triggered:
Wire `getCardCrossReferences` in `libs/bc/study/src/card-cross-references.ts` to query the new plan-to-card join. The Plans row on the Cross-references panel at `apps/study/src/routes/(app)/memory/[id]/+page.svelte` already has the empty-state shape; only the query and a "Plans" row populating logic need to change.

References:

- [spec.md](spec.md) Out of scope section
- [spec.md](spec.md) In scope section -- "Plans: study plans that include this card (plan-to-card enrollment is TBD)"
- [spec.md](spec.md) Product decisions section, item 3

## Public card comments, likes, or feedback

Status: Deferred

What was deferred:
Any engagement affordance on the `/cards/<id>` public page (comments, likes, share counts, feedback button). v1 is a static shareable view.

Why:
Engagement requires moderation, identity, and abuse-handling infrastructure that does not yet exist. Adding a single "like" button is a deceptively small change with a large hidden cost (account integration, spam protection, audit, privacy).

Trigger to revisit:
When a user-zero-validated reason for public engagement on a single card emerges (e.g., cards are widely shared and feedback is the bottleneck on improving them).

Implementation pattern when triggered:
Author a fresh WP via `/ball-wp-spec`. The follow-on WP needs to ship moderation + identity + privacy in tandem with the UI; do not skip those.

References:

- [spec.md](spec.md) Out of scope section
- [spec.md](spec.md) Why section -- "static shareable view in v1"

## Reps-to-card enrollment populating cross-ref row

Status: Deferred

What was deferred:
The Reps row on the Cross-references panel showing reps that cite a specific card. Today the row renders as an "honest empty state" with a "coming soon" affordance per [spec.md](spec.md) Product decisions item 3.

Why:
A first-class reps-to-card linkage does not exist yet; reps may reference content via citations (when `content-citations` lands) or via direct enrollment (TBD). The data shape needs settling before the cross-ref row populates.

Trigger to revisit:
When reps gain a first-class card-citation linkage (either through `content-citations` or a direct rep-to-card foreign key).

Implementation pattern when triggered:
Extend `getCardCrossReferences` in `libs/bc/study/src/card-cross-references.ts` to query the reps linkage. The Reps row's empty state already exists; only the query needs to change.

References:

- [spec.md](spec.md) Out of scope section
- [spec.md](spec.md) In scope section -- Reps row
- [spec.md](spec.md) Data model section -- "deferred query shape"

## Scenario cross-ref row populating from citations

Status: Deferred

What was deferred:
The Scenarios row on the Cross-references panel showing scenarios that cite a specific card. Today the row renders as an empty state pending the `content-citations` WP.

Why:
Scenario-to-card linkage flows through citations, which live in the `content-citations` WP. Until that WP lands, there is no data to query.

Trigger to revisit:
When the `content-citations` WP lands and scenario citations exist in the database.

Implementation pattern when triggered:
Extend `getCardCrossReferences` to query the citations table for scenario references to the card. The Scenarios row's empty state already exists; only the query needs to change.

References:

- [spec.md](spec.md) Out of scope section
- [spec.md](spec.md) In scope section -- Scenarios row
- [docs/work-packages/content-citations/spec.md](../content-citations/spec.md)

## Course-source label on the public card page

Status: Deferred

What was deferred:
A human-readable course name surfaced on `/cards/<id>` when `source_type = 'course'`. Today the public card page renders `source_type` only, without resolving the underlying course label.

Why:
The decision was punted to build time per [spec.md](spec.md) Open questions. No course-source card currently needs the label exposed publicly; resolving the `source_ref` to a human label is straightforward but the surface design hasn't been validated.

Trigger to revisit:
When the first course-source card needs to surface its source label publicly (likely when a course author wants attribution on shared cards).

Implementation pattern when triggered:
Extend `getPublicCard` in `libs/bc/study/src/cards-public.ts` to resolve `source_ref` against the course table when `source_type = 'course'`. Surface the human-readable name on the public page; never leak the opaque `source_ref` string.

References:

- [spec.md](spec.md) Open questions section, first bullet

## OpenGraph tags on the public card page

Status: Deferred

What was deferred:
OpenGraph meta tags on `/cards/<id>` for link-preview rendering on platforms that scrape them (Slack, iMessage, Discord, etc.). Default decision is "yes eventually, copy deferred to build."

Why:
The exact OG copy needs validation (front question vs first 200 chars vs domain summary). No learner has yet shared a card link on a platform that renders previews, so the right copy shape is untested.

Trigger to revisit:
When a learner first shares a `/cards/<id>` URL on a platform that renders previews and the bare title is insufficient.

Implementation pattern when triggered:
Add `<svelte:head>` OG tags in `apps/study/src/routes/cards/[id]/+page.svelte`. Mirror any existing OG-tag pattern on `apps/runway/` if Runway has shipped one; otherwise pick a minimal set (`og:title`, `og:description`, `og:type=article`).

References:

- [spec.md](spec.md) Open questions section, second bullet

## Denormalize session-count onto `card_state`

Status: Deferred

What was deferred:
Caching the count of sessions that included a card as a denormalized column on `study.card_state`, to avoid the live `session_item_result` join on every cross-ref panel render.

Why:
Live query is fast today (the join is bounded by the per-card session set, which is small). Denormalization adds write-path complexity (every session insert updates a counter) for no measured perf gain.

Trigger to revisit:
When the live `session_item_result` join is shown to be slow (e.g., a learner with thousands of sessions hits a noticeable cross-ref panel render delay).

Implementation pattern when triggered:
Add `session_count` to `study.card_state`. Update on `session_item_result` insert and delete via a Drizzle transaction in the session-close BC function. Backfill via a one-shot script.

References:

- [spec.md](spec.md) Open questions section, third bullet
