---
pr: 403
date: 2026-05-02
title: "fix(sources): atomic writes via tmp+rename for all source/derivative writers"
wp_id: null
bugs_fixed: []
summary: |
  Cluster D fix from the 10x sources/content-pipeline review (chunk 4). ADR 021 mandates that the cache layout never expose a partially-written file at its canonical path. The reference implementation in libs/aviation/src/sources/download.ts already streams to .part + rename; this change brings every other source/derivative writer in line so a SIGINT or network drop mid-write leaves either the prior file or no file -- never a half-written destination.
---
