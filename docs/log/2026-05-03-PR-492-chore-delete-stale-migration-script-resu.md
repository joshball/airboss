---
pr: 492
date: 2026-05-03
title: "chore: delete stale migration script (resurrected by rebase ordering)"
wp_id: rename-generic-content-files
bugs_fixed: []
summary: |
  WP-CFR (#491) branched from before the rename WP's Phase 8 commit that deleted scripts/migrate/rename-generic-content-files.ts. When #491 squash-merged, it brought the script back. Per ADR-021 precedent (migration scripts land and die in the same PR), delete it.
---
