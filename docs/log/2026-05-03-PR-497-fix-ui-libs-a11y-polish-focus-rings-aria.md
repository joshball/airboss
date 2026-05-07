---
pr: 497
date: 2026-05-03
title: "fix(ui-libs): a11y polish — focus rings, aria wiring, untrack guard"
wp_id: null
bugs_fixed: []
summary: |
  Salvage of a11y polish work that an agent committed on fix/ui-library-themes-review-2026-05-02 but never opened a PR for. The original 3-commit branch went stale and its earlier commits conflict heavily with sibling chunk-5 review PRs (#449, #451, #456, #465, #467, #469) that already shipped the same intent. Cherry-picking the standalone polish commit onto fresh main yielded only 3 trivial textual conflicts (Button import, paletteEl bind removal, sortIndicator commentary), all resolved without dropping any functionality.
---
