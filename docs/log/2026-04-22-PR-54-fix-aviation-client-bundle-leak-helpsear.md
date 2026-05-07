---
pr: 54
date: 2026-04-22
title: "fix: aviation client-bundle leak + HelpSearchPalette effect loop"
wp_id: null
bugs_fixed: []
summary: |
  Split @ab/aviation so extractor exports (CfrExtractor, cfrExtractor, allExtractors, resolveExtractors) live at @ab/aviation/sources instead of the main barrel. They transitively import node:fs and were leaking into the Vite client bundle via glossary/+page.ts, blowing up /dashboard with Module "node:fs" has been externalized for browser compatibility. Fix the $effect loop in HelpSearchPalette.svelte. The effect wrote results and then read results.aviation.length in the same block, which Svelte 5 treats as a self-dependency -> effect_update_depth_exceeded on every keystroke. The aborted flush...
---
