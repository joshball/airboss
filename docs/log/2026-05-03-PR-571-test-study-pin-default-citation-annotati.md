---
pr: 571
date: 2026-05-03
title: "test(study): pin default citation annotation in references.test.ts (chunk-1 testing CRITICAL)"
wp_id: review-tail-2026-05
bugs_fixed: []
summary: |
  Closes the chunk-1 testing CRITICAL in docs/work/reviews/2026-05-01-study-app-surfaces-testing.md: the references.test.ts historical-lens tests asserted only kind === 'historical' for the lens-flag and acks paths, never the default. A regression that flipped the default to 'historical' would mark every citation in production as historical and pass green.
---
