---
title: 'User Stories: Evidence Kind Data Layer'
product: study
feature: evidence-kind-data-layer
type: user-stories
status: unread
review_status: pending
---

# User Stories: Evidence Kind Data Layer

This WP closes WP B's three `not_applicable` shims by shipping the substrate (`card.kind`, `scenario.assessment_methods`, the `teaching-exercise` session-item-kind, and the `teaching_exercise` table) so every per-kind gate computes against real authored data.

WP B's user stories described the gating contract from the learner's seat. This WP's stories describe the *authoring* surface the contract demands and the *substrate* invariants the data layer guarantees.

Anchors: [spec](./spec.md), [design](./design.md), [tasks](./tasks.md), [test plan](./test-plan.md), [WP B user stories](../evidence-kind-gating/user-stories.md).

## Authoring cards by knowledge kind

- As a content author seeding cards from yaml, I want a `kind:` field on each card entry so I can mark a calculation card as calculation and a recall card as recall without inventing my own convention.
- As a content author, I want a card without an explicit `kind` to default to `recall` so existing yaml files keep working and the migration is safe.
- As a content author, I want the parser to reject `kind: bogus` at parse time so a typo can't slip a malformed value into the DB.
- As a content author editing a card in hangar, I want a Recall / Calculation selector on the card editor so the kind gets captured at authoring time, not retrofitted.
- As a content author, I want the audit script `bun run db check card-kinds` to show me how many cards in each domain still carry the migration default so I have a punch list of rows to review.
- As a content author, I want `card.kind` to be independent of `card.cardType` so a `regulation` card can still be recall or calculation; the two axes don't fight.

## Authoring scenarios by assessment method

- As a content author writing a scenario, I want to declare its assessment methods (`scenario`, `demonstration`, or both) so the per-kind gates downstream count the rep against the right pillar.
- As a content author writing a hybrid maneuver scenario (judge then demonstrate), I want to tag it `['scenario','demonstration']` so the same rep contributes to both gates rather than forcing me to author two rows.
- As a content author, I want a scenario without explicit methods to default to `['scenario']` so existing scenarios keep behaving as judgment reps without retroactive intervention.
- As a content author, I want the BC to reject an empty `assessment_methods` array, duplicate entries, and out-of-enum values so a malformed authoring step fails loud, not silent.
- As a content author editing a scenario in hangar, I want a multi-checkbox over the four sensible methods (`scenario`, `demonstration`, `recall`, `calculation`) so I can express dual-purpose scenarios in one place.
- As a content author, I want the audit script `bun run db check scenario-assessment-methods` to show me which scenarios still carry the default `['scenario']` vs which were explicitly authored so the content team can prioritize the audit.

## CFI teaching exercises as a real entity

- As a CFI content author, I want a `teaching_exercise` table separate from `scenario` so a free-response teaching prompt doesn't have to pretend to be a multiple-choice decision rep with a NULL options array.
- As a CFI content author, I want a teaching exercise to carry `title`, `prompt`, and an optional `node_id` so the teaching gate can scope evidence to the right knowledge node.
- As a CFI content author, I want the `teaching-exercise` session-item-kind to land as one value (not split by modality) so the rollup keeps a single teaching gate and modality lives on the exercise's own metadata.
- As a CFI candidate, I want my completed teaching exercises to feed the per-node teaching gate via the same threshold logic as reps so a CFI K leaf with `requires_teaching=true` reads as not-mastered until I've actually taught the concept.
- As Joshua-as-user-zero rebuilding CFI knowledge, I want the substrate ready before any CFI ACS-25 transcription work starts so that authoring WP has somewhere concrete to land.

## Substrate invariants the BC guarantees

- As a downstream BC consumer, I want `card.kind` NOT NULL with a CHECK constraint so my partition query can rely on every card carrying a valid value.
- As a downstream BC consumer, I want `scenario.assessment_methods` NOT NULL with a non-empty array invariant so the `LATERAL UNNEST` query never produces null methods.
- As a downstream BC consumer, I want `(item_kind = 'teaching-exercise')` to imply `(teaching_exercise_id IS NOT NULL)` (and vice versa) so the teaching gate join is always resolvable.
- As a downstream BC consumer, I want the index on `(card.user_id, card.kind)` so per-kind queries don't fan out across the user's whole card pool.
- As a downstream BC consumer, I want the migration to run as metadata-only (no table rewrite) so it ships even on a populated DB without a maintenance window.

## Mastery rewire: shims become real

- As a learner with three mastered `kind='recall'` cards on a node and zero calculation cards, I want `recall = pass` and `calculation = not_applicable` so the gate state distinguishes "you don't have this kind" from "you tried and failed."
- As a learner with three mastered `kind='calculation'` cards on a K leaf that wants recall, I want the leaf to read as not-mastered with `missingKinds=['recall']` so I know my calculation work didn't satisfy the K-leaf requirement.
- As a learner with reps on a scenario tagged `['scenario','demonstration']`, I want both gates to count the same reps so the hybrid scenario actually closes both pillars when it's authored that way.
- As a learner with reps on a scenario tagged only `['demonstration']`, I want the `scenario` gate to read as `not_applicable` so an R leaf (which wants judgment scenarios) doesn't read as satisfied by demonstration-only evidence.
- As a CFI candidate with three completed teaching-exercise rows on a node plus mastered recall cards on the same node, I want the leaf with `requires_teaching=true` to read as mastered so the substrate's correctness is observable end-to-end.
- As a CFI candidate with mastered recall but zero teaching exercises, I want `teaching = not_applicable` and `missingKinds = ['teaching']` so the dashboard surfaces what closes the gap.

## What stays unchanged

- As a learner, I want my existing card mastery and scenario rep history to keep counting after the migration. The partition reads from the same data; nothing gets re-counted from scratch.
- As a learner, I want the engine to keep picking the same items as before. WP B and this WP are read-side only; engine selection is a separate WP.
- As a learner, I want FSRS scheduling to keep behaving identically; this WP doesn't touch the scheduler.
- As a learner, I want the dual-gate threshold semantics (`CARD_MIN`, `REP_MIN`, the per-pillar ratios) to stay so my mastery boundary doesn't move under me.
- As a learner, I want `getNodeMastery` and `isLeafMastered` shapes to stay; only the data quality behind them improves.

## What we are not building (so users don't ask)

- As a learner, I do **not** expect CFI ACS-25 leaves to suddenly carry `requires_teaching=true` after this WP. The substrate is here; the content WP is separate.
- As a learner, I do **not** expect any teaching exercises to appear in my session queue. The engine doesn't pick them yet; that's a follow-on WP.
- As a learner, I do **not** expect per-kind threshold tuning (e.g., scenario reps wanting a higher minimum than judgment reps). Thresholds stay global; tune later if data demands it.
- As a learner, I do **not** expect `card_type` (basic / cloze / regulation / memory_item) to change. Presentation form stays its own axis next to the new knowledge-kind axis.
- As a content author, I do **not** expect the migration to auto-classify existing cards as calculation. Everything defaults to recall, and the audit script surfaces what to flip.
- As a content author, I do **not** expect a GIN index on `scenario.assessment_methods`. Only added if profiling shows the LATERAL UNNEST is a hot path.
- As a CFI candidate, I do **not** expect a teaching-exercise editor UI. A future content WP owns the editor route; v1 ships the table + BC CRUD only.

## For Joshua-as-user-zero

- As Joshua, I want my existing seed cards and seed scenarios to keep working after the migration so the seed pathway doesn't need a manual reset.
- As Joshua, I want the audit scripts to show me where the migration's defaults are wrong (calculation cards classified as recall, demonstration scenarios classified as judgment) so I have a punch list of rows to flip during my own content authoring.
- As Joshua, I want the substrate to ship before I start CFI ACS-25 transcription so the content work has somewhere concrete to land.
- As Joshua, I want the per-kind gate logic to be testable in isolation so when a future tuning lands (per-kind thresholds, per-cert mappings), it's a small PR and not a re-architecture.
- As Joshua, I want `bun run check` to stay clean across the whole tree after this WP so any consumer that exhaustively switches on `SESSION_ITEM_KINDS` is forced to handle `teaching-exercise` at compile time, not runtime.
- As Joshua, I want the WP B `mastery.ts` file-header note that documents the three shims to go away when this WP ships. The substrate makes the doc obsolete, and a stale doc is a known issue.
