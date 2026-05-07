---
pr: 316
date: 2026-04-28
title: "feat(sources): orders + ntsb registry seeding (Phase 10 next slice)"
wp_id: null
bugs_fixed: []
summary: |
  PR #309 shipped Phase 10 first slice (locator + URL + citation + resolvers) but deferred ingestion, which left every authored airboss-ref:orders/... or airboss-ref:ntsb/... URL hitting row-2 ERROR (\"identifier does not resolve to a registered entry\"). This adds manifest-driven registry seeding for both corpora so authored URLs validate clean.
---
