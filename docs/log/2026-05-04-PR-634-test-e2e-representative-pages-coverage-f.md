---
pr: 634
date: 2026-05-04
title: "test(e2e): representative-pages coverage for the flightbag reader"
wp_id: null
bugs_fixed: []
summary: |
  New parameterised Playwright spec at tests/e2e/flightbag/representative-pages.spec.ts that walks first/middle/last sections per active reference and asserts each one renders with 2xx + non-empty H1. Coverage at write time: every handbook (PHAK, AFH, IFH, IPH, AvWX, RMH, mtn-tips, Aviation Instructor's), AIM (paragraphs; appendix skipped), every active CFR title/part. ~28 parameterised tests; full run completes in ~10s on a warm dev server. The spec drives URLs directly from the seeded (documentSlug, edition, code) tuple via ROUTES.FLIGHTBAG_* -- it doesn't go through urlForReference(), so a...
---
