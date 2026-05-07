---
pr: 339
date: 2026-04-29
title: "fix(sources): HTML idempotency (etag check before content-length)"
wp_id: null
bugs_fixed: []
summary: |
  PR #338 manual tests caught that AIM HTML files re-downloaded on every run (53 of 54 files re-fetched), while the AIM PDF and all PHAK chapter PDFs HEAD-cached correctly.
---
