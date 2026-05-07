---
pr: 525
date: 2026-05-03
title: "feat(study): WP-IFH -- promote Instrument Flying Handbook to section-tree"
wp_id: whole-doc-promotion
bugs_fixed: []
summary: |
  Promotes IFH (FAA-H-8083-15B) from a whole-doc Class C row in handbooks-extras.yaml to a chapter-aware section-tree handbook at handbooks/ifh/FAA-H-8083-15B/. Per the whole-doc promotion research and WP-IFH-SECTION-TREE spec. Adds a new outline_strategy: toc-file-sidecar / section_strategy: toc-file-sidecar to the Python ingest. The strategy parses a hand-extracted TOC markdown file at the path declared in toc_file:. IFH is the canonical instance: no embedded PDF outline, no chapter PDFs, hand-extracted TOC at docs/work-packages/whole-doc-promotion/source-tocs/ifh.md. Resolves the IFH chapter...
---
