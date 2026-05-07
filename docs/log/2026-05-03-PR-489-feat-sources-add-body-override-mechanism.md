---
pr: 489
date: 2026-05-03
title: "feat(sources): add body_override mechanism for whole-doc handbooks"
wp_id: null
bugs_fixed: []
summary: |
  Adds an optional body_override field to whole-doc handbook YAML entries. When set, the produced document.md is the override file's contents verbatim instead of pdftotext extraction. The PDF still provides page_count; the cache manifest still tracks source bytes; only the body markdown is replaced.
---
