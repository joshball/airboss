---
pr: 326
date: 2026-04-29
title: "docs: source cache flat naming spec"
wp_id: null
bugs_fixed: []
summary: |
  One-pass migration plan to kill the half-migrated source cache layout introduced in PR #255. Drops source.pdf / source.xml, the symlink shim, and the _errata/ subdirectory. Flattens AC/ACS/AIM/regs cache trees. Folds per-doc manifests into per-corpus index files. Encodes handbook errata as <edition>-errata-<id>.pdf co-located with the primary PDF.
---
