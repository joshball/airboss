---
pr: 335
date: 2026-04-29
title: "fix(handbook-ingest): remove DEFAULT_CHAPTER_TEXT_MAX_CHARS; require explicit cap for prompt strategy"
wp_id: null
bugs_fixed: []
summary: |
  Follow-up to #332. PR #332 fixed the three configured handbooks but left DEFAULT_CHAPTER_TEXT_MAX_CHARS = 60000 in config_loader.py as a silent fallback. Any future handbook authored for section_strategy: prompt without explicitly setting the cap would silently inherit the broken default and re-introduce the same truncation bug.
---
