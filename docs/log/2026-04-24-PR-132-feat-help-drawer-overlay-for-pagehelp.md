---
pr: 132
date: 2026-04-24
title: "feat(help): drawer overlay for PageHelp"
wp_id: session-legibility-and-help-expansion
bugs_fixed: []
summary: |
  <PageHelp> chicklets now open a slide-over drawer in-place instead of navigating to /help/<id>. Content renders via the same HelpSection + MarkdownBody pipeline the full-page route uses, so authors maintain one markdown pipeline. Drawer state persists through ?help=<id>: clicking writes the param via replaceState, and arriving at a URL with the param auto-opens the matching PageHelp. Reload and deep-link both work without cluttering history. New generic Drawer primitive in @ab/ui (subpath-exported at @ab/ui/components/Drawer.svelte). Focus-trap, Esc-to-close, scrim-click-to-close, slide-in...
---
