---
title: 'User Stories: Evidence Kind Gating'
product: study
feature: evidence-kind-gating
type: user-stories
status: unread
review_status: pending
---

# User Stories: Evidence Kind Gating

## Mastery that means what it says

- As a learner prepping for a checkride, I want a "skill" leaf to require demonstration evidence so my dashboard doesn't claim mastery I haven't earned.
- As a learner studying steep turns, I want recall cards on aerodynamics not to count as "I can fly steep turns" because the maneuver hasn't been demoed.
- As a learner, when my dashboard says I've mastered a leaf, I want to trust the claim because the evidence behind it matches the kind of knowledge.
- As a learner, I want a "knowledge" leaf to be satisfiable by recall cards because that's what the FAA's K elements actually test.
- As a learner, I want a "risk-management" leaf to require scenario evidence because judgment is what's being graded.

## CFI candidates -- teaching evidence

- As a CFI candidate, I want CFI leaves marked "teach this concept" to require teaching exercises so my evidence shape matches the FAA's actual standard.
- As a CFI candidate, I want recall mastery on the underlying knowledge to be necessary but not sufficient for a CFI K leaf -- I have to demonstrate I can teach it, not just know it.
- As a CFI candidate, I want to see explicitly which leaves still need teaching evidence so I can prioritize teaching exercises.
- As a CFI candidate, I want my dashboard to surface "you have recall on these 12 CFI leaves but no teaching on any of them" so I know where to focus.

## Surfacing the gap

- As a learner who's mastered the cards on an S leaf, I want the dashboard to say "you've got the concepts; you need scenario / demonstration to be ready" so I know what to do next.
- As a learner, I want each leaf to show me which evidence kinds are missing so my study queue feels purposeful.
- As a learner, I want the missing-kinds list to be specific: "scenario" not "skill" -- I need to know which kind of session to run.
- As a learner with an S leaf where every required kind has at least one passing node in the linked graph, I want the leaf to flip to mastered without me having to demo every linked node.

## Multi-node leaves

- As a learner studying a leaf that links to multiple knowledge nodes (e.g., steep turns links to aerodynamics + load factor + coordination), I want the leaf to master when the maneuver is demonstrated -- I don't need to demo every linked concept individually.
- As a learner, I want the rollup to find the evidence wherever it lives in the linked-node set, not require me to redo the same evidence per linked node.
- As a learner, I want the per-evidence-kind state to aggregate sensibly across linked nodes so a leaf with rich evidence on one node and skeleton on others still masters.

## What I expect about the dashboard's numbers

- As a learner whose cert dashboard previously showed 80% mastery, after this WP I might see 65% because the new gate is stricter. I want a release note saying so, not surprise numbers.
- As a learner, I want the explanation to be "we now require the right kind of evidence per leaf" -- a clear, non-jargon reason.
- As a learner, when my number drops, I want the dashboard to surface what evidence would close the gap -- not just "you went down" but "do these scenarios to come back up."

## What I expect to keep working

- As a learner, the engine should keep picking the same items as before the change -- the engine reads from cards + scenarios per the existing logic, untouched here.
- As a learner, my plan, my goal, my session length, my focus / skip lists -- all unchanged.
- As a learner, my existing card mastery and scenario rep history -- unchanged. The new gate reads from the same data; none of it gets re-counted.
- As a learner, the knowledge-graph BC's `getNodeMastery` -- unchanged. Per-node mastery means the same thing.

## What we are not building (so users don't ask)

- As a learner, I do **not** expect the engine to start prioritizing items that close evidence-kind gaps in this WP. That's a follow-on engine WP.
- As a learner, I do **not** expect the cert dashboard to show "12 leaves missing scenario" headlines without me drilling in -- the page-level rendering of the richer rollup is a follow-on UI WP.
- As a learner, I do **not** expect per-card or per-scenario `assessment_methods` editing tools in this WP. The arrays already exist on cards / scenarios; this WP consumes them.
- As a learner, I do **not** expect dual-gate thresholds to change. `CARD_MIN`, `REP_MIN`, and the threshold ratios stay.
- As a learner, I do **not** expect FSRS scheduling to change. Read-side / rollup change only.
- As a learner, I do **not** expect bloom-level gating per evidence kind in this WP. The leaf's `required_bloom` exists but isn't gated against per-card bloom.
- As a learner, I do **not** expect teaching exercises to suddenly show up. The data layer is ready; teaching-exercise content is incremental authoring after this WP.

## For Joshua-as-user-zero

- As Joshua, I want my returning-CFI rebuild to surface CFI leaves that need teaching evidence so the rebuild has a clear next-action target.
- As Joshua, I want the cert dashboard to not lie about my mastery -- if I haven't demoed steep turns, the dashboard shouldn't say I have.
- As Joshua, I want the per-evidence-kind state to be queryable from the BC so I can build follow-on UIs that show "12 of your CFI K leaves need teaching exercises -- create them here."
- As Joshua, I want the rollup math to be testable in isolation so a future tuning (e.g., per-kind thresholds) is a small PR, not a re-architecture.
- As Joshua, I want the change to be release-notable -- the cert dashboard's numbers will shift, and that shift is meaningful, not noise.
