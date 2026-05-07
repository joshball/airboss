---
pr: 230
date: 2026-04-27
title: "docs(adr-018): source artifact storage policy (Flavor D: cache + dormant LFS plumbing)"
wp_id: handbook-ingestion-and-reader
bugs_fixed: []
summary: |
  Establishes the three-tier storage rule for content artifacts before the handbook-ingestion-and-reader WP lands. Configuration is **Flavor D** -- developer-local cache for source PDFs, dormant LFS plumbing in .gitattributes so the policy can flip later without re-architecture.
---
