---
title: 'Out of Scope: Snooze and Flag'
product: study
feature: snooze-and-flag
type: out-of-scope
status: unread
---

# Out of Scope: Snooze and Flag

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                              | Status       | Trigger to revisit                                                      |
| ------------------------------------------------- | ------------ | ----------------------------------------------------------------------- |
| Hangar-side author-review queue UI                | Follow-on WP | When Hangar grows a content-moderation / triage surface                 |
| Taxonomy reassignment on `wrong-domain` resolve   | Follow-on WP | When Hangar grows a taxonomy / domain-edit surface                      |
| Community-visible feedback (public likes / flags) | Rejected     | Never -- see detail below                                               |
| Bulk snooze / bulk remove                         | Rejected     | Never -- see detail below                                               |
| `like` nudging FSRS interval                      | Deferred     | When like usage data shows it correlates with retention                 |
| Hard-exclude on `wrong-domain`                    | Deferred     | When learners report repeated 60d snoozes on the same cross-domain card |

## Hangar-side author-review queue UI

Status: Follow-on WP

What was deferred:
The admin-facing UI that lists `bad-question` snoozes and `flag` feedback for author triage. The data is captured (rows in `study.card_snooze` and `study.card_feedback`) and ready to be queried via a UNION; only the moderation surface is out.

Why:
Hangar is the authoring app, not the user-facing study app. Building the queue UI inside the study WP would mix surfaces and pull authoring concerns (workflow, status transitions, edit affordances) into a flow whose job is to capture signals. Keeping the data layer here and the UI in Hangar lets each WP stay focused.

Trigger to revisit:
When Hangar grows a content-moderation / triage surface, or when the volume of unresolved `bad-question` rows hits a threshold the user wants visible. Concrete signal: more than ~10 unresolved rows or a user request for "show me what's flagged."

Implementation pattern when triggered:
New WP under `docs/work-packages/` whose primary surface is in `apps/hangar/`. Query target: `SELECT ... FROM study.card_snooze WHERE reason = 'bad-question' AND resolved_at IS NULL UNION SELECT ... FROM study.card_feedback WHERE signal = 'flag'`. Existing BC functions (`snoozeCard`, `submitFeedback`) already capture the data; the new WP adds a Hangar load function plus a triage UI.

References:

- `docs/work-packages/snooze-and-flag/spec.md` "Out of scope" and "Open questions"
- `libs/bc/study/src/schema.ts` (~line 1098)

## Taxonomy reassignment on `wrong-domain` resolve

Status: Follow-on WP

What was deferred:
The flow that lets an author move a card to a different domain once a `wrong-domain` snooze surfaces it. The snooze captures the signal and the comment; the reassignment lives elsewhere.

Why:
Taxonomy edits belong in Hangar (the authoring surface), not in study (the learner surface). The reassignment also has its own product surface area (cascading effects on session composition, learner deck membership) that warrants a dedicated WP.

Trigger to revisit:
When Hangar grows a taxonomy / domain-edit surface, or when there are enough unresolved `wrong-domain` rows that the user wants to act on them.

Implementation pattern when triggered:
A Hangar WP that loads `wrong-domain` snooze rows, opens the affected card for edit (existing card-edit BC), and on save closes the snooze (set `resolved_at`). The card-edit BC already exists; the new wiring is the snooze-close step.

References:

- `docs/work-packages/snooze-and-flag/spec.md` "Out of scope"

## Community-visible feedback (public likes / flags)

Status: Rejected

What was rejected:
Exposing `like`, `dislike`, or `flag` signals to other users or to public surfaces. All feedback is private to the user and the content author.

Why:
Public feedback turns a quality signal into a social signal, which changes how users vote (popularity bias, performative ratings, retaliation flags). Keeping feedback private to the learner-author loop preserves signal quality. Community features, if ever built, would be a different product shape and need their own privacy review.

Trigger to revisit:
Never -- see detail above. A future community / social study surface would open its own WP with explicit privacy scope.

References:

- `docs/work-packages/snooze-and-flag/spec.md` "Out of scope"

## Bulk snooze / bulk remove

Status: Rejected

What was rejected:
Multi-card bulk snooze or bulk remove flows. The v1 substrate is single-card only.

Why:
Bulk operations require UI surface area (multi-select, confirmation modals, undo at scale) that is unjustified before single-card flows are battle-tested. Bulk also invites accidents: a misclick on bulk-remove can soft-remove a learner's entire deck. The conservative default is single-card with clear restore from Browse.

Trigger to revisit:
Never -- see detail above. If a real workflow ever requires bulk (for example, an instructor cleaning up a shared deck), open a new WP with explicit safety scope (typed confirmation, scoped to a deck, restore-all affordance).

References:

- `docs/work-packages/snooze-and-flag/spec.md` "Out of scope"

## `like` nudging FSRS interval

Status: Deferred

What was deferred:
Letting a `like` feedback signal nudge the FSRS scheduler toward longer intervals (the assumption being that "I like this card" correlates with "I'll remember it longer").

Why:
The default in spec is silent: `like` records the signal but does not touch the schedule. The reasoning is that the correlation between subjective enjoyment and retention is unproven, and silently shifting intervals would conflate two different feedback channels.

Trigger to revisit:
When `like` usage data shows it correlates with retention strongly enough to be a useful FSRS input. Concrete signal: a backwise analysis on a few weeks of data showing `like`-flagged cards have lower retrieval failure rates at matched interval positions.

Implementation pattern when triggered:
Add an optional `feedback_modifier` to the FSRS scheduling input in `libs/bc/study/src/engine.ts`. Route the modifier through `ENGINE_SCORING` constants (`libs/constants/src/engine.ts`), not inline literals, per the project rule.

References:

- `docs/work-packages/snooze-and-flag/spec.md` "Open questions"
- `libs/constants/src/engine.ts` `ENGINE_SCORING`

## Hard-exclude on `wrong-domain`

Status: Deferred

What was deferred:
Letting `wrong-domain` optionally hard-exclude a card from the user's deck forever rather than applying the default 60d long snooze.

Why:
The default 60d snooze is a soft form that lets the substrate self-correct (the card may get reassigned to the correct domain via the future Hangar taxonomy WP, and the snooze expires automatically). A hard exclude reduces self-correction surface and risks orphaning a re-classified card.

Trigger to revisit:
When learners report repeated 60d snoozes on the same cross-domain card (signal: the same `card_id` accumulates multiple `wrong-domain` rows over time, suggesting the taxonomy fix never lands).

Implementation pattern when triggered:
Add an optional `hard_exclude: boolean` column on `study.card_snooze` (only meaningful for `reason = 'wrong-domain'`). FSRS scheduler treats `hard_exclude = true` like a permanent removal until restored from Browse. The Browse "Removed" filter already shows excluded rows.

References:

- `docs/work-packages/snooze-and-flag/spec.md` "Open questions"
- `libs/bc/study/src/schema.ts` `card_snooze` table
