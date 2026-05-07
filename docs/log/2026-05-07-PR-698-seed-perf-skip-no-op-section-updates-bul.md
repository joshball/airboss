---
pr: 698
date: 2026-05-07
title: "seed perf: skip no-op section UPDATEs, bulk knowledge upsert, drop migrate txn"
wp_id: null
bugs_fixed: []
summary: |
  Targeted follow-up to PR #696. Day-to-day re-seed of the heavy phases (handbooks) drops from 1m+ to ~5s; fresh reset drops from ~4m+ to ~4m30s end-to-end (the cold-path INSERTs still dominate when the DB is empty).
---
