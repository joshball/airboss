---
pr: 614
date: 2026-05-04
title: "feat(handbook-extraction): OCR-leak detection (WP-HANDBOOK-RE-EXTRACTION-V2 1D)"
wp_id: null
bugs_fixed: []
summary: |
  Detects + elides OCR-leak runs in section bodies. The IFH 2/5 phonetic-alphabet figure leak (r R 0 q Q9 p P 8 o O7 n N6 z ZZ y Y Y x XX ...) is the canonical case: a figure escaped the figure-clipper and its OCR'd contents bled into the surrounding section.
---
