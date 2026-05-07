---
pr: 402
date: 2026-05-02
title: "refactor(sources): consolidate cache-root resolution + register env vars"
wp_id: knowledge-graph
bugs_fixed: []
summary: |
  Cluster B fix from the 2026-05-01 sources-content-pipeline 10x review. Five defaultCacheRoot() helpers plus the script helper and study-server hook all open-coded the same process.env.AIRBOSS_HANDBOOK_CACHE ?? join(homedir(), 'Documents', 'airboss-handbook-cache') pattern; four of those five skipped ~/ expansion (so AIRBOSS_HANDBOOK_CACHE=~/cache produced literal ~/cache/... paths on disk). The env var itself, plus AIRBOSS_QUIET and GH_TOKEN, were missing from the central ENV_VARS registry.
---
