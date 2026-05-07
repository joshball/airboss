---
pr: 367
date: 2026-04-30
title: "docs(WP): evidence-kind-data-layer (closes WP B not_applicable shims)"
wp_id: evidence-kind-data-layer
bugs_fixed: []
summary: |
  Work package that closes the three not_applicable shims left by WP B (evidence-kind-gating, PR #361). Substrate-only: schema + BC + authoring tooling. Empty defaults are safe (every card → recall, every scenario → ['scenario'], no teaching-exercise rows). After this WP, every per-kind gate in mastery.ts computes against authored data instead of returning not_applicable shims.
---
