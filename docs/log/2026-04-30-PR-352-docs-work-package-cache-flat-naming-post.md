---
pr: 352
date: 2026-04-30
title: "docs(work-package): cache-flat-naming post-merge findings -- PHAK errata file loss"
wp_id: source-cache-flat-naming
bugs_fixed: []
summary: |
  Filed observed evidence that PR #327's migration step likely lost PHAK's MOSAIC errata cache file during rename. AFH was unaffected. Self-healed by --apply-errata mosaic later (idempotent path); no operator action needed today.
---
