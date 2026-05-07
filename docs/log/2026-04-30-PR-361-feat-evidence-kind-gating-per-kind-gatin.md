---
pr: 361
date: 2026-04-30
title: "feat(evidence-kind-gating): per-kind gating, isLeafMastered, lens + credential rollup"
wp_id: evidence-kind-gating
bugs_fixed: []
summary: |
  Implements evidence-kind-gating. A syllabus leaf is now mastered only when the learner has cleared the appropriate evidence *kind* for that leaf -- not just any card or rep. K-triad leaves accept recall; R-triad leaves require scenario; S-triad leaves accept demonstration OR scenario. Instructor / ATP cert applicability tightens the K mapping. CFI pedagogical leaves stack a teaching requirement on top via the new requires_teaching flag.
---
