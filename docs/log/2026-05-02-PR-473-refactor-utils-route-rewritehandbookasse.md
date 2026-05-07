---
pr: 473
date: 2026-05-02
title: "refactor(utils): route rewriteHandbookAssetUrl through ROUTES.HANDBOOK_ASSET"
wp_id: null
bugs_fixed: []
summary: |
  Closes the chunk-1 patterns major finding 'handbook-asset URL shape not in ROUTES'. Convergent with PR #466 which added ROUTES.HANDBOOK_ASSET(path) to libs/constants/src/routes.ts; this PR updates the last residual inline literal in libs/utils/src/markdown.ts:rewriteHandbookAssetUrl.
---
