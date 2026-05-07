---
pr: 668
date: 2026-05-06
title: "feat(regulations): CFR nav tree + canonical eCFR links on every card"
wp_id: null
bugs_fixed: []
summary: |
  Add the CFR structural model (Title -> Chapter -> Subchapter -> Part) as a decoupled YAML sidecar (regulations/cfr-<title>/<edition>/nav-tree.yaml) and use it to mint canonical eCFR URLs on every regulations card across the library surface. CFR card variants now require external -- guaranteed by the URL builder, which always returns a non-null URL (falling back to the eCFR shortcut form when chapter context is missing).
---
