---
pr: 337
date: 2026-04-29
title: "feat(sources): chapter source ingestion (PHAK chapters, AIM HTML, ADR 022)"
wp_id: chapter-source-ingestion
bugs_fixed: []
summary: |
  Implements docs/work-packages/chapter-source-ingestion/spec.md end-to-end. Closes the section-extraction truncation bug (11 of 17 PHAK chapters were silently capped at 60K chars, dropping turbines / fuel / oxygen / pressurized aircraft / chapter summaries from the LLM input) by ingesting per-chapter assets directly.
---
