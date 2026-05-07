---
pr: 29
date: 2026-04-22
title: "refactor(themes): paint body from tokens (:root defaults for web)"
wp_id: null
bugs_fixed: []
summary: |
  Removes hardcoded hex values from apps/study/src/app.html by promoting the web theme's tokens to :root defaults. Body renders correctly from first paint (no FOUC, works without JS) while [data-theme='tui'] still wins inside its subtree.
---
