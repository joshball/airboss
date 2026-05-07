---
pr: 255
date: 2026-04-27
title: "fix(scripts): download-sources -- correct URLs, UA header, auto-date, named files, HEAD-cache"
wp_id: null
bugs_fixed: []
summary: |
  Follow-up to #253. The first version of bun run download-sources shipped with a broken URL list, no User-Agent, no auto-detection of valid eCFR snapshot dates, and a confusing naming convention. The operator ran it and got mostly 403s and 404s. This PR fixes all of it and adds a --verify audit mode so the URL list can be checked without downloading.
---
