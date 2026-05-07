---
pr: 251
date: 2026-04-27
title: "feat(sources): ADR 019 phase 6 -- handbook corpus"
wp_id: reference-handbook-ingestion
bugs_fixed: []
summary: |
  Phase 6 of the ADR 019 rollout. Registers a handbooks corpus into the @ab/sources registry, lighting up airboss-ref:handbooks/... URLs for lessons. Reuses the derivative tree shipped by ADR 016 phase 0 (#242) -- this PR is registration-only; it does NOT re-run the PDF -> markdown extraction pipeline.
---
