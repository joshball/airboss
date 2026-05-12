---
title: 'Out of Scope: Spaced Memory Items'
product: study
feature: spaced-memory-items
type: out-of-scope
status: unread
---

# Out of Scope: Spaced Memory Items

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                  | Status       | Trigger to revisit                                                               |
| ----------------------------------------------------- | ------------ | -------------------------------------------------------------------------------- |
| Card templates (regulation fill-in, plate quiz)       | Deferred     | When a domain authoring flow needs structured cards beyond basic / cloze         |
| Image / audio attachments on cards                    | Deferred     | When a card kind (charts, weather imagery, ATC audio) requires non-text payloads |
| Import / export (CSV, Anki format)                    | Deferred     | When a user migrating from Anki or another tool asks for it                      |
| Shared decks / community card pools                   | Rejected     | Never -- see detail below                                                        |
| Auto-generation from FAR / AIM or other sources       | Follow-on WP | When the truth-aware generator program lands a generator that produces cards     |
| Offline / PWA support                                 | Deferred     | When mobile / no-connectivity usage becomes a real complaint                     |
| FSRS parameter optimization from user review data     | Deferred     | When enough review data exists to optimize the 19 FSRS-5 parameters per user     |
| Integration hooks (missed rep -> card, route -> card) | Follow-on WP | When the first consumer surface (sim missed reps, route walkthrough) needs cards |

## Card templates (regulation fill-in, plate quiz)

Status: Deferred

What was deferred:
Additional values for the `card_type` column on `study.card` (today the `CARD_TYPES` constant exposes `basic`, `cloze`, `regulation`, `memory_item`). New card template kinds such as regulation fill-in-the-blank, plate-quiz, and similar structured prompt types are out of scope.

Why:
The spec ships the minimal `card_type` set needed for Joshua's current studying (regs, airspace, basic prose). Extending the constant before a real authoring flow needs the new shape risks shipping unused enum values and matching UI scaffolding.

Trigger to revisit:
When a course or product authoring flow has a concrete need for a structured card kind (e.g. the regulations course wants fill-in-the-blank rendering, or an avionics course wants a plate-quiz card type).

Implementation pattern when triggered:
Add the new value to `CARD_TYPES` in `libs/constants/src/study.ts`. The DB column is `text`, not an enum, so no schema migration is needed (see spec.md "Domain taxonomy extension" edge case for the same pattern applied to `DOMAINS`). Add render + edit handling in the card create / detail / review components keyed off `card_type`.

References:

- [spec.md "Out of Scope"](./spec.md)
- [spec.md "Edge Cases" -- "Domain taxonomy extension"](./spec.md)

## Image / audio attachments on cards

Status: Deferred

What was deferred:
Card payloads with non-text content (images, audio clips). The `front` and `back` columns on `study.card` are markdown text only; there is no attachment table, no object-storage wiring, and no media handling in the create / browse / review flows.

Why:
The first wave of cards is regs and conceptual prose. Adding storage plumbing (object store, signed URLs, mime validation, accessibility metadata) before the content actually requires it would build infrastructure without a customer.

Trigger to revisit:
When a card kind has a concrete need for non-text payload (e.g. weather chart cards needing METAR / TAF imagery, ATC audio drills needing clip playback, plate-quiz cards needing approach-plate snippets).

Implementation pattern when triggered:
Add an attachment table in the `study` schema (mirror existing `study.card_state` shape for composite PK / FK back to `card`). Decide media storage per [ADR 018](../../decisions/018-source-artifact-storage-policy/decision.md) before writing any code: the developer-local cache pattern likely applies for source media, derivatives stay inline.

References:

- [spec.md "Out of Scope"](./spec.md)
- [ADR 018 source artifact storage policy](../../decisions/018-source-artifact-storage-policy/decision.md)

## Import / export (CSV, Anki format)

Status: Deferred

What was deferred:
Round-trip import / export of cards. No CSV upload, no Anki `.apkg` parsing, no JSON dump endpoint. Users cannot migrate an existing deck into airboss and cannot extract their deck out.

Why:
Joshua (user zero) is authoring cards in airboss from scratch as he relearns; he does not have an existing Anki deck to import. Building a robust importer for a non-customer is gold-plating.

Trigger to revisit:
When a user with a non-trivial existing deck (Anki, Quizlet, CSV from a prep tool) asks to migrate, OR when data-portability becomes a stated platform requirement.

Implementation pattern when triggered:
Server-only endpoint that accepts a file upload, validates each row against the existing `createCard` validation in spec.md "Validation", and inserts cards with `source_type: 'imported'` and an opaque `source_ref` recording the origin. Mirror the validation shape from the in-app card creation route (`apps/study/src/routes/(app)/memory/new/+page.server.ts` per tasks.md step 8).

References:

- [spec.md "Out of Scope"](./spec.md)
- [spec.md `source_type` / `source_ref` columns](./spec.md)

## Shared decks / community card pools

Status: Rejected

What was rejected:
A community deck library where users publish, browse, subscribe to, or fork decks authored by other users.

Why:
airboss is private / all-rights-reserved hosted by Joshua (see global memory: "License + hosting"). There is no public user base today, and the product taxonomy ("~3 products: ground school, sim, avionics") does not include a community surface. Building community plumbing (publishing, moderation, attribution, abuse handling) without a public user base is overhead with no payoff. A re-decision would require the product reopening multi-user / community as a goal.

References:

- [spec.md "Out of Scope"](./spec.md)
- Global memory: License + hosting (private / all-rights-reserved)
- Global memory: Product taxonomy

## Auto-generation from FAR / AIM or other sources

Status: Follow-on WP

What was deferred:
Generators that read a source corpus (FAR / AIM / handbook / weather products) and emit candidate flashcards into the `study.card` table with `source_type: 'imported'`. No bulk seeding, no LLM extraction, no scheduled jobs.

Why:
Truth-aware generators are an explicit platform program (global memory: "Truth-aware generators are the killer pedagogy"). The first instance is the weather engine. Card generation is a downstream consumer of those generators, not a feature of the spaced-memory-items WP.

Trigger to revisit:
When the truth-aware generator program lands a generator whose output is naturally card-shaped (prompt + answer + domain + source reference), AND when authoring decides flashcards are the right surface for that generator's output.

Implementation pattern when triggered:
Spawn a dedicated WP (`/ball-wp-spec`). The generator runs server-side, emits cards with `source_type: 'imported'` and a `source_ref` like `<generator-id>:<run-id>:<card-index>`, and consumes the existing `createCard` BC function in `libs/bc/study/src/cards.ts`. No DB schema changes required: the `source_type` / `source_ref` schema in spec.md was deliberately designed to support this.

References:

- [spec.md "Out of Scope"](./spec.md)
- [spec.md `source_type` / `source_ref` columns](./spec.md)
- Global memory: Truth-aware generators are the killer pedagogy

## Offline / PWA support

Status: Deferred

What was deferred:
Service-worker / PWA install support, offline review queue, background sync when connectivity returns. Review currently requires an online server round-trip per rating.

Why:
Reviewing on the ground at a desk with connectivity is the only use case today. Offline review would require materializing the due queue client-side, queuing review submissions, and reconciling FSRS state on reconnect: non-trivial work for a non-customer.

Trigger to revisit:
When mobile / no-connectivity usage becomes a real complaint (e.g. studying on a flight, at an airfield with poor data), OR when a sibling app on the same surface requires offline support and the cost can be shared.

Implementation pattern when triggered:
Service worker that caches the due batch on session start, queues `submitReview` form actions locally, and reconciles with the server on reconnect. The FSRS algorithm is a pure function in `libs/bc/study/src/srs.ts` and can run identically client-side or server-side; the constraint is keeping the materialized `study.card_state` consistent across both ends.

References:

- [spec.md "Out of Scope"](./spec.md)

## FSRS parameter optimization from user review data

Status: Deferred

What was deferred:
Per-user (or platform-global) optimization of the 19 FSRS-5 parameters. Today `fsrsDefaultParams()` returns hard-coded defaults from the reference ts-fsrs implementation.

Why:
The spec explicitly states "collecting data from day one; optimization is future." Optimizing parameters before there is enough real review data to fit them is curve-fitting noise. We are collecting the data needed (every `study.review` row stores rating, confidence, stability, difficulty, elapsed, scheduled, state) so optimization can run later without backfill.

Trigger to revisit:
When a single user has accumulated enough reviews that per-user optimization would meaningfully outperform defaults (ts-fsrs documentation suggests ~1000 reviews per user as a rough threshold), OR when platform-global defaults can be improved by aggregating across users.

Implementation pattern when triggered:
Add `fsrsOptimizeParams(reviews)` to `libs/bc/study/src/srs.ts` mirroring the optimizer in [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs). Per-user parameter storage goes on a new `study.fsrs_params` table keyed by `user_id`; `fsrsSchedule()` reads the user's params if present, else falls back to `fsrsDefaultParams()`.

References:

- [spec.md "Out of Scope"](./spec.md)
- [spec.md "FSRS-5 algorithm"](./spec.md)

## Integration hooks (missed rep -> card, route walkthrough -> card)

Status: Follow-on WP

What was deferred:
Cross-product flows that auto-create cards from another surface's events. Examples: a missed scenario rep in the sim app spawns a card targeting the missed concept; a route walkthrough in a future spatial app spawns cards from route-specific knowledge. The `source_type: 'course'` / `source_type: 'product'` and `source_ref` schema supports this; the actual integration flows are out of scope.

Why:
The schema was deliberately designed to support these flows (see spec.md `source_type` / `source_ref` columns, "Source card becomes uneditable" edge case, and user-stories.md "Future integration"). The flows themselves require consumer surfaces (sim, route walkthrough) that don't exist yet.

Trigger to revisit:
When the first consumer surface has a concrete need to push cards. Most likely candidates: a sim WP for missed-rep capture, OR a route-walkthrough WP that wants cards as a takeaway.

Implementation pattern when triggered:
Spawn a per-consumer follow-on WP. Each consumer calls `createCard` from `libs/bc/study/src/cards.ts` with `source_type` set to its product / course tag and `source_ref` formatted as `<source>:<id>` (see spec.md examples: `firc:mod1:card-042`, `route-walkthrough:kbjc-approach`). The cards land in the same review queue as personal cards: "one study flow, not two" per user-stories.md.

References:

- [spec.md "Out of Scope"](./spec.md)
- [spec.md `source_type` / `source_ref` columns + edge cases](./spec.md)
- [user-stories.md "Future integration"](./user-stories.md)
