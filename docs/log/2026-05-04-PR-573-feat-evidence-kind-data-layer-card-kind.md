---
pr: 573
date: 2026-05-04
title: "feat(evidence-kind-data-layer): card.kind + scenario.assessment_methods + teaching-exercise item kind"
wp_id: evidence-kind-data-layer
bugs_fixed: []
summary: |
  Closes the three not_applicable shims that evidence-kind-gating (PR #361) deliberately deferred. After this WP every per-evidence-kind mastery gate computes against authored data instead of the shim.
---
