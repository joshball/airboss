---
pr: 70
date: 2026-04-23
title: "fix(auth): drop event.url.hash read in requireAuth"
wp_id: null
bugs_fixed: []
summary: |
  requireAuth read event.url.hash, which SvelteKit now forbids on the server — every (app) route was 500ing on load. Fragments are never sent to the server anyway, so the hash slot in redirectTo was always empty in practice. Dropping the read.
---
