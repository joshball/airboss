---
pr: 242
date: 2026-04-27
title: "feat(handbooks): ADR 016 phase 0 -- ingestion pipeline + reader + read-state"
wp_id: handbook-ingestion-and-reader
bugs_fixed: []
summary: |
  ADR 016 Phase 0: handbook ingestion pipeline + reader UI + read-state tracking. Three FAA handbooks ingested at section-granularity (PHAK 850 rows, AFH 531 rows, AvWX 480 rows = 1861 total). Reader live at /handbooks/...; heartbeat + suggestion banner; bidirectional citation integration on knowledge nodes. ADR 018 (storage policy: cache + dormant LFS plumbing) and ADR 020 (edition + errata policy) shipped alongside. AFH MOSAIC errata located but not applied (waits on --apply-errata flow). 31 commits, 3693 files. See docs/work-packages/handbook-ingestion-and-reader/tasks.md for the...
---
