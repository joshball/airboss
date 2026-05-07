---
pr: 700
date: 2026-05-07
title: "feat(hangar): Phase 8 - /roadmap view (read-only WP browser)"
wp_id: tracking-system-overhaul
bugs_fixed: []
summary: |
  Phase 8 of tracking-system-overhaul -- ships the in-app surface for browsing every docs/work-packages/<slug>/spec.md frontmatter from the hangar. Reads through scripts/lib/wp-loader.ts (the loader's top-of-file comment already anticipates this exact callsite), applies URL-shareable filters, and renders a status-grouped board plus a per-WP detail view with sub-doc tabs.
---
