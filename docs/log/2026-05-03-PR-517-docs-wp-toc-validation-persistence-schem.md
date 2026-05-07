---
pr: 517
date: 2026-05-03
title: "docs(wp): TOC validation persistence schema spec"
wp_id: null
bugs_fixed: []
summary: |
  Draft spec for the on-disk shape of TOC validation state. Per-doc manifests at validation/<corpus>/<doc>/<edition>/manifest.json with verified/flagged/skipped/pending/drifted per entry. Drift-detection auto-resets entries when source content changes.
---
