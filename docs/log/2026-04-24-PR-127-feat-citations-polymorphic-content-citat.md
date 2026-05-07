---
pr: 127
date: 2026-04-24
title: "feat(citations): polymorphic content_citations + picker + card wiring (Bundle C)"
wp_id: null
bugs_fixed: []
summary: |
  ## What New study.content_citations table (polymorphic source/target with partial indexes + unique constraint). libs/constants/src/citations.ts: CITATION_SOURCE_TYPES, CITATION_TARGET_TYPES, labels, context max-length. New BC lib @ab/bc-citations with createCitation, deleteCitation, getCitationsOf, getCitedBy, resolveCitationTargets, plus per-target-type search helpers (searchRegulationNodes, searchAcReferences, searchKnowledgeNodes). Shared CitationPicker Svelte component with per-target-type tabs, debounced server-backed search, optional context note (500-char cap), inline URL+title form...
---
