---
pr: 284
date: 2026-04-28
title: "chore: consolidate auth-rate-limit + study-schema + extract-hangar-bc into one migration"
wp_id: auth-rate-limit
bugs_fixed: []
summary: |
  Single PR that bundles three work-package PRs and replaces the accumulated migration history with one regenerated initial migration. The per-PR drizzle migrations were colliding on numeric prefixes (multiple 0007_*) and the schema-vs-migration ordering broke composite FKs.
---
