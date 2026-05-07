---
pr: 613
date: 2026-05-04
title: "feat(handbook-extraction): empty-section policy (WP-HANDBOOK-RE-EXTRACTION-V2 1D)"
wp_id: null
bugs_fixed: []
summary: |
  Detects and remediates "empty section" rows -- sections the v1 extractor produced when a heading was split off without its paragraph (IFH chapter 1's 'Introduction' is the canonical case). Three branches keyed on the dotted-decimal section code, driven by the per-doc YAML empty_section_policy: block (already parsed by 1C-foundation).
---
