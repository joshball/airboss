---
pr: 384
date: 2026-05-01
title: "feat(sources): handbooks-extras ingestion pipeline (6 docs)"
wp_id: library-broad-extraction-survey
bugs_fixed: []
summary: |
  Closes library-broad-extraction-survey gap 5: six FAA whole-doc-only Class C handbooks (risk-management, aviation-instructor, IFH, IPH, AMT-G, AMT-P) had downloads gated behind --include-handbooks-extras but no register pipeline. After this PR, all six are queryable in the runtime registry.
---
