---
title: 'Out of Scope: Regulations Course Weeks 3-10'
product: course
feature: regulations-course-weeks-3-10
type: out-of-scope
status: unread
---

# Out of Scope: Regulations Course Weeks 3-10

Deferred items, why they're deferred, and the trigger that should make
us revisit each. Future agents and humans: do not build these without
the documented trigger. If you think the trigger is hit, surface it
for a decision rather than building silently.

## Summary

| Item                                                       | Status   | Trigger to revisit                                            |
| ---------------------------------------------------------- | -------- | ------------------------------------------------------------- |
| Knowledge-graph nodes for Weeks 3-10 lessons               | Deferred | When a parallel knowledge-graph authoring pull is dispatched  |
| Drill -> flashcard conversion into apps/study/             | Deferred | When the regulations course needs to feed the spaced-rep deck |
| Weeks 1 and 2 content                                      | Rejected | Never -- already shipped under prior WPs                      |
| Capstones `night-ifr-passenger.md`, `gear-up-night-ifr.md` | Rejected | Never -- already shipped under prior WPs                      |

## Knowledge-graph nodes for Weeks 3-10 lessons

Status: Deferred

What was deferred:
Authoring atomic ADR-011 knowledge-graph nodes for the regulations
identified in Weeks 3-10 lessons (e.g. `reg-flight-review-61-56`,
plus the dozens of analogues across Parts 61/91/135/141 covered in this
WP). Lessons identify candidate node slugs via the frontmatter
`ties_to_knowledge_nodes` field, but the nodes themselves are not
authored under this WP.

Why:
Week 2's authored content set this posture: lessons name proposed
nodes and defer them so the regulations-course pull stays bounded and
linear (one author voice, one validator pass). Knowledge-graph nodes
are authored against the ADR-011 discovery-first pedagogy with a
different review cadence and a separate corpus of WHY-led derivations;
parallelizing them with course authoring increases coordination cost
without improving either output.

Trigger to revisit:
When a parallel knowledge-graph authoring pull is dispatched. The
signal is a WP scoped to "author the regulations-domain knowledge
nodes" (or a broader knowledge-graph backfill that touches this
domain). The lesson frontmatter `ties_to_knowledge_nodes` arrays are
the seed list for that WP.

Implementation pattern when triggered:
Follow [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md)
for node shape. Each candidate slug already nominated in a lesson's
frontmatter becomes one node file under `course/knowledge/`.

References:

- [spec.md](./spec.md) §"What's explicitly out of scope" original bullet 1
- [ADR 011](../../decisions/011-knowledge-graph-learning-system/decision.md) -- knowledge-graph learning system

## Drill -> flashcard conversion into apps/study/

Status: Deferred

What was deferred:
Importing the `drills.md` content from Weeks 3-10 (Locate / Diagnose /
Distinguish / Trap-detector format) into the `apps/study/` spaced-rep
deck as flashcards. Drills today exist as readable markdown inside
the course directory; they are not part of any study session.

Why:
The drill format is content, not engineering. Conversion requires a
deck-spec authoring pass, a card-type decision (Locate maps to one
shape, Diagnose to another), and a seed-courses integration. That is
a separate engineering pull and would block the content authors on
a study-app concern.

Trigger to revisit:
When the regulations course needs to feed the spaced-rep deck for
real-time student practice. The signal is a learner-facing request
("study these drills before the oral"), or the cert-dashboard surfacing
the gap between authored course content and tested mastery.

Implementation pattern when triggered:
Mirror the deck-spec authoring pattern used for existing study decks
(see `libs/bc/study/src/seed-courses.ts` for the seed-validator path).
Decide on one card-type per drill format, write a small converter, and
run it once per week directory.

References:

- [spec.md](./spec.md) §"What's explicitly out of scope" original bullet 2
- [course/regulations/week-02-part-61-deep/drills.md](../../../course/regulations/week-02-part-61-deep/drills.md) -- canonical drill shape

## Weeks 1 and 2 content

Status: Rejected

What was rejected:
Re-authoring or modifying Weeks 1 and 2 content (`week-01-overview`,
`week-02-part-61-deep`) as part of this WP.

Why:
Weeks 1 and 2 are already shipped under prior WPs and set the depth,
voice, and citation style that Weeks 3-10 inherit. Touching them now
would either (a) regress quality silently, or (b) require a re-review
that does not advance the course's completeness goal. Reconciling
ordering or scope mismatch only happens if a sub-agent's authoring
reveals one, per Phase 3 of [tasks.md](./tasks.md).

Re-decision bar:
The Week 2 voice or citation style would need to be deprecated by a
subsequent ADR (e.g. a successor to ADR 019 changes the `airboss-ref:`
URI form), OR a learner-facing audit would need to flag a Week 1/2
regression. Either is a re-decision, not a quiet edit.

References:

- [spec.md](./spec.md) §"What's explicitly out of scope" original bullet 3
- [course/regulations/week-02-part-61-deep/](../../../course/regulations/week-02-part-61-deep/) -- the model week

## Capstones `night-ifr-passenger.md`, `gear-up-night-ifr.md`

Status: Rejected

What was rejected:
Re-authoring or modifying the two prior capstone orals
(`course/regulations/orals/night-ifr-passenger.md`,
`course/regulations/orals/gear-up-night-ifr.md`).

Why:
Both were authored before ADR 019 was finalized and ship as capstone
references against the Week 2 voice. The two new capstones authored
under this WP (`friend-flight-review.md`, `ppl-applies-for-ir.md`)
match the same difficulty bar. Re-authoring the shipped capstones is
out of scope; the four capstones together flip the CHANGELOG status
row from "2/4" to "4/4."

Re-decision bar:
Same as Weeks 1 and 2: a citation-form ADR change, or a learner-facing
audit flag. Default is "no."

References:

- [spec.md](./spec.md) §"What's explicitly out of scope" original bullet 4
- [course/regulations/orals/night-ifr-passenger.md](../../../course/regulations/orals/night-ifr-passenger.md)
- [course/regulations/orals/gear-up-night-ifr.md](../../../course/regulations/orals/gear-up-night-ifr.md)
