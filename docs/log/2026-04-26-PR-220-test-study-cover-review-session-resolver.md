---
pr: 220
date: 2026-04-26
title: "test(study): cover review-session resolvers and route actions"
wp_id: review-sessions-url
bugs_fixed: []
summary: |
  Closes the Sprint 2 finding (carried into Sprint 3 and missed) that the deck-spec resolver functions on the review-sessions-url feature shipped without tests. Adds BC coverage for findResumableSessionByDeckHash and listSavedDecks plus route-action coverage for /memory/review ?/resume and ?/fresh. Tests run against the real dev Postgres, matching the established pattern in libs/bc/study/src/**/*.test.ts.
---
