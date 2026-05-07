---
pr: 562
date: 2026-05-03
title: "feat(stage-5): cross-link citation audit + corpus mapping helper"
wp_id: library-completeness
bugs_fixed: []
summary: |
  Adds the **stage-5 cross-link audit** (bun run sources audit-citations) -- the last unbuilt piece of the source-ingestion pipeline per docs/ingestion-pipeline/pipeline.md. Walks study.content_citations and reports dead targets, dead sources, resolver coverage gaps, and invalid external_ref URLs. Adds corpusForSourceType / corpusForCitationTarget -- single source of truth for mapping a hangar.reference.tags.sourceType value (cfr, ac, phak, ...) to the corpus name the resolver registry registers under (regs, ac, handbooks, ...). Used by the audit today; the citation chip render dispatch can...
---
